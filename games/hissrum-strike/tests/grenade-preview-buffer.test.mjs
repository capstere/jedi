import test from 'node:test';
import assert from 'node:assert/strict';
import {GrenadePreviewBuffer,canPreviewGrenade} from '../src/grenade-preview-buffer.mjs';
import {grenadeTrajectory} from '../src/fps/grenade-ballistics.mjs';
import {CONFIG} from '../src/fps/config.mjs';
const path=[{x:0,y:0,z:0},{x:3,y:4,z:0},{x:3,y:4,z:12}];
test('dashed preview keeps both Float32 arrays and skips 600 identical rewrites',()=>{
 const b=new GrenadePreviewBuffer(),p=b.positions,d=b.distances;
 assert.equal(b.write(path),true);
 for(let i=0;i<600;i++)assert.equal(b.write(path),false);
 assert.equal(b.positions,p);assert.equal(b.distances,d);
 assert.deepEqual([...d.slice(0,3)],[0,5,17]);
 const same=path.map(p=>({...p}));same[1].x+=1e-12;
 assert.equal(b.write(same),false,'sub-Float32 changes must not dirty GPU data');
 same[1].x+=1;assert.equal(b.write(same),true);
});
test('shortening and re-extending routes uses exact valid draw counts, never an old tail',()=>{
 const b=new GrenadePreviewBuffer();b.write(path);
 assert.equal(b.write(path.slice(0,2)),true);assert.equal(b.count,2);
 assert.equal(b.write(path),true);assert.equal(b.count,3);
 assert.equal(b.distances[2],17);
 b.reset();assert.equal(b.count,0);assert.equal(b.write(path),true);
});
test('route capacity is bounded and writes never alter authoritative ballistic points',()=>{
 const b=new GrenadePreviewBuffer(4),p=Array.from({length:80},(_,i)=>({x:i,y:i/3,z:2*i}));
 const before=structuredClone(p);b.write(p);
 assert.equal(b.count,4);assert.equal(b.positions.length,12);
 assert.deepEqual(p,before);assert.throws(()=>new GrenadePreviewBuffer(1),RangeError);
});
test('empty, one-point and nonfinite paths fail closed, and a new path recovers',()=>{
 const b=new GrenadePreviewBuffer();
 for(const p of [null,[],[path[0]],[path[0],null],[path[0],{x:NaN,y:2,z:3}],
  [path[0],{x:Infinity,y:2,z:3}],[path[0],{x:1e100,y:2,z:3}]]){
  b.write(path);assert.equal(b.write(p),true);assert.equal(b.count,0);
 }
 assert.equal(b.write(path),true);assert.equal(b.count,3);
});
test('guide is infantry-only and respects paused/dead/disabled/empty-inventory states',()=>{
 const game={state:{paused:false},player:{alive:true,weapon:'he',vehicleId:null,inventory:{he:1,smoke:1,flash:1}}};
 assert.equal(canPreviewGrenade(game),true);
 game.player.flying=true;assert.equal(canPreviewGrenade(game),true);
 game.player.vehicleId='cartridge-tank';assert.equal(canPreviewGrenade(game),false);
 game.player.vehicleId=null;game.state.paused=true;assert.equal(canPreviewGrenade(game),false);
 game.state.paused=false;assert.equal(canPreviewGrenade(game,false),false);
 for(const type of ['he','flash','smoke']){game.player.weapon=type;assert.equal(canPreviewGrenade(game),true);}
 game.player.weapon='sniper';assert.equal(canPreviewGrenade(game),false);
 game.player.weapon='he';game.player.inventory.he=0;assert.equal(canPreviewGrenade(game),false);
 game.player.inventory.he=1;game.player.alive=false;assert.equal(canPreviewGrenade(game),false);
 assert.equal(canPreviewGrenade(null),false);
});
test('buffer matches the unchanged shared grenade integrator exactly at Float32 precision',()=>{
 const actor={x:1,y:0,z:2,height:1.7,pitch:.2,yaw:.7,isPlayer:true};
 const config={...CONFIG,playerGrenadeSpeed:17};
 let rays=0;const world={raycast:()=>{rays++;return null;}};
 const p=grenadeTrajectory(actor,config,world),copy=structuredClone(p),b=new GrenadePreviewBuffer();
 b.write(p);
 for(let i=0;i<b.count;i++)for(const [axis,j]of [['x',0],['y',1],['z',2]])
  assert.equal(b.positions[i*3+j],Math.fround(p[i][axis]));
 assert.ok(rays>10);assert.deepEqual(p,copy);
 actor.pitch+=.2;assert.equal(b.write(grenadeTrajectory(actor,config,world)),true);
});
