import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {updateBotFlight} from '../src/fps/bot-flight.mjs';
import {initializeWanderers} from '../src/fps/action-rules.mjs';
import {AudioSystem,AUDIO_SAMPLES} from '../src/audio.mjs';
import {Game} from '../src/fps/game.mjs';

test('Hissrum uses real Kenney CC0 OGG sound bytes and Safari-compatible MP3',()=>{
 const dir=resolve(fileURLToPath(new URL('.',import.meta.url)),'../assets/audio');
 assert.equal(AUDIO_SAMPLES.length,15);
 let fallbackCount=0;
 for(const sample of AUDIO_SAMPLES){
  const ogg=readFileSync(resolve(dir,sample+'.ogg'));
  assert.equal(ogg.toString('ascii',0,4),'OggS',sample);
  const mp3File=resolve(dir,sample+'.mp3');
  if(!existsSync(mp3File))continue; // ambient generator can replace special OGG chains
  const mp3=readFileSync(mp3File);
  assert.ok(mp3.byteLength>256,sample+' MP3 fallback empty');
  assert.ok(mp3.toString('ascii',0,3)==='ID3'||mp3[0]===255,sample+' MP3 signature invalid');
  fallbackCount++;
 }
 assert.ok(fallbackCount>=10,'iPhone Safari requires at least ten MP3 effect fallbacks');
 const audio=new AudioSystem({},{volume:.55});
 assert.equal(audio.volume,.55);
 audio.setVolume(0);assert.equal(audio.volume,0);
});

test('Dwarfs use eight separated connected real room nodes with five original visual variants',()=>{
 const nodes=[];
 for(let i=0;i<12;i++)for(let j=0;j<12;j++)nodes.push({x:i*2.2,z:j*2.2});
 const g={seed:2026,state:{wanderers:[]},config:{wanderers:true},
   actors:[],world:{navigation:{nodes},canOccupy:()=>true}};
 initializeWanderers(g);
 assert.equal(g.state.wanderers.length,8);
 assert.ok(g.wanderNodes.length>8);
 assert.equal(new Set(g.state.wanderers.map(a=>a.variant)).size,5);
 for(const [i,a] of g.state.wanderers.entries()){
  assert.equal(a.kind,'dwarf');
  assert.equal(a.height,.86);
  assert.equal(a.alive,true);
  for(const b of g.state.wanderers.slice(0,i))
   assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=3-.00001,'dwarfs must not stack at spawn');
 }
 const h={...g,seed:2026,state:{wanderers:[]}};
 initializeWanderers(h);
 assert.deepEqual(h.state.wanderers.map(a=>[a.x,a.z]),g.state.wanderers.map(a=>[a.x,a.z]));
});

function fixture(){
 const actor={id:'analysts-2',index:2,team:'analysts',bot:{},isPlayer:false,
   x:3,z:3,y:0,radius:.2,height:1.7,yaw:0,pitch:0,alive:true,
   onGround:true,vy:0,crouching:false,flying:false,steps:0,moving:0,distanceWalked:0};
 const events=[];
 const g={seed:1,state:{time:5},config:{botFlight:true,botSpeed:3.2,flySpeed:5.8,
     standingHeight:1.7,crouchingHeight:1.08,crouchSpeed:1.35,sneakSpeed:1.65,
     runSpeed:4.6,gravity:18},
   actors:[actor],hostages:[],bomb:{status:'inactive',carrierId:null},
   world:{canOccupy:(x,z,r,h,y)=>y>=0&&y<6,canStand:()=>true,
     materialAt:()=> 'concrete',navigation:{nearest:()=>({x:3,z:3})}},
   emit:(type)=>events.push(type),
   moveBody:(a,dx,dy,dz)=>{a.x+=dx;a.z+=dz;a.y=Math.max(0,Math.min(4,a.y+dy));
     return {collision:false,onGround:a.y===0};}
 };
 return {g,actor,events};
}

test('bot autonomously takes off, ascends through real movement physics, hovers and lands',()=>{
 const {g,actor,events}=fixture();
 const takeoff={forward:.2};
 updateBotFlight(g,actor,takeoff,1/30);
 assert.equal(actor.flying,true);
 assert.equal(takeoff.jump,true);
 assert.ok(events.includes('bot-takeoff'));
 const y0=actor.y;
 Game.prototype.moveActor.call(g,actor,takeoff,.20);
 assert.ok(actor.y>y0+.2);
 assert.equal(actor.vy,0);
 actor.y=actor.airPatrol.goalY;
 const hover={};
 updateBotFlight(g,actor,hover,1/30);
 assert.equal(hover.jump,false);
 assert.equal(hover.crouch,false);
 const height=actor.y;
 Game.prototype.moveActor.call(g,actor,hover,.1);
 assert.equal(actor.y,height);
 g.state.time=actor.airPatrol.until+.1;
 const landing={};
 updateBotFlight(g,actor,landing,1/30);
 assert.equal(landing.crouch,true);
 assert.equal(landing.jump,false);
 Game.prototype.moveActor.call(g,actor,landing,.2);
 assert.ok(actor.y<height,'bot must descend toward the actual floor');
 actor.y=0;
 updateBotFlight(g,actor,{},1/30);
 assert.equal(actor.flying,false);
 assert.ok(events.includes('bot-landed'));
});

test('bot flight respects bomb carrier, objective interactions and simultaneous flight limits',()=>{
 const {g,actor}=fixture();
 g.bomb.carrierId=actor.id;
 updateBotFlight(g,actor,{},.1);
 assert.equal(actor.flying,false,'bomb carrier may not leave planting floor');
 g.bomb.carrierId=null;
 g.actors=[actor,...Array.from({length:4},(_,i)=>({id:'counter-'+i,alive:true,bot:{},flying:true}))];
 updateBotFlight(g,actor,{},.1);
 assert.equal(actor.flying,false,'no more than four active flyers');
 g.actors=[actor];
 actor.action={type:'defuse'};
 updateBotFlight(g,actor,{},.1);
 assert.equal(actor.flying,false,'objective action is never interrupted by flight');
});

test('non-player bots use authoritative collision-based Game.moveActor flight branch',()=>{
 const {g,actor}=fixture();
 actor.flying=true;actor.y=.5;
 Game.prototype.moveActor.call(g,actor,{jump:true,forward:1},.12);
 assert.ok(actor.y>.5);
 assert.ok(actor.z<3);
 assert.equal(actor.vy,0,'no gravity during bot flight');
});
