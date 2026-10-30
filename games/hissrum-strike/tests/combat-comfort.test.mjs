import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseRespawn,SPAWN_CANDIDATE_LIMIT,SPAWN_RETRY_SECONDS} from '../src/fps/respawn.mjs';
import {friendlyLineClear,tickActionState,respawnActor} from '../src/fps/action-rules.mjs';
import {Game,WEAPONS} from '../src/fps/game.mjs';
import {lifeReadout} from '../src/life-readout.mjs';
import {sanitizePreferences,readPreferences,writePreferences,pixelRatioFor,baseFov,shouldRender} from '../src/player-preferences.mjs';
function fixture(){
 const anchor={x:0,z:0,yaw:.5},other={x:5,z:0,yaw:.5};
 const world={anchors:{analysts:[anchor,other],counterAnalysts:[{x:0,z:-20}],hostages:[],bomb:{x:0,z:8},rescue:{x:0,z:9}},
  navigation:{nodes:[]},canOccupy:()=>true,segmentClear:()=>true,raycast:()=>null};
 const g=new Game(world,{config:{mode:'endless',wanderers:false,spawnProtection:1.4,respawnDelay:2.7,liveShop:true}});
 const a={id:'player',name:'Du',team:'analysts',index:0,isPlayer:true,x:0,y:0,z:0,yaw:0,pitch:0,radius:.2,height:1.7,alive:false,
  respawnAt:1,deaths:0,kills:0,money:1000};
 Object.assign(g.state,{mode:'endless',phase:'active',time:1,actors:[a],hostages:[],wanderers:[],drops:[]});
 return {g,a,world,anchor,other};
}
test('respawn validates standing height after crouched death and waits if no real space fits',()=>{
 const {g,a,world}=fixture();a.height=1.08;
 world.canOccupy=(x,z,r,h)=>h<1.3;
 assert.equal(chooseRespawn(g,a),null);assert.equal(respawnActor(g,a),false);assert.equal(a.alive,false);
 world.canOccupy=(x,z,r,h)=>x===5&&h===1.7;
 assert.equal(respawnActor(g,a),true);assert.equal(a.x,5);assert.equal(a.height,1.7);
 assert.equal(a.spawnProtectedUntil,2.4);assert.equal(a.money,1000);
});
test('respawn rejects occupants and tank but allows a safely separated flying teammate',()=>{
 const {g,a,world}=fixture();world.anchors.analysts.length=1;
 const ally={...a,id:'ally',alive:true};g.actors.push(ally);
 assert.equal(chooseRespawn(g,a),null);
 ally.y=5;assert.equal(chooseRespawn(g,a).x,0);
 g.state.tank={alive:true,x:0,z:0,radius:1};assert.equal(chooseRespawn(g,a),null);
 g.state.tank.alive=false;ally.y=1;assert.equal(chooseRespawn(g,a),null);
});
test('respawn prefers cover and rechecks moving enemies on every attempt',()=>{
 const {g,a,world}=fixture();const enemy={...a,id:'enemy',team:'counterAnalysts',alive:true,x:0,z:-5};g.actors.push(enemy);
 world.segmentClear=p=>p.x===0;
 assert.equal(chooseRespawn(g,a).x,5);
 world.segmentClear=p=>p.x===5;
 assert.equal(chooseRespawn(g,a).x,0);
});
test('respawn candidates and ray work stay bounded, distant enemies need no geometry ray',()=>{
 const {g,a,world}=fixture();world.navigation.nodes=Array.from({length:5000},(_,i)=>({x:(i%100)/10,z:Math.floor(i/100)/10}));
 let occupancy=0,rays=0;world.canOccupy=()=>{occupancy++;return true;};world.segmentClear=()=>{rays++;return true;};
 g.actors.push({...a,id:'enemy',alive:true,team:'counterAnalysts',x:100,z:100});
 assert.ok(chooseRespawn(g,a));assert.ok(occupancy<=SPAWN_CANDIDATE_LIMIT);assert.equal(rays,0);
 occupancy=0;g.actors[1].x=1;g.actors[1].z=-3;chooseRespawn(g,a);
 assert.ok(occupancy<=SPAWN_CANDIDATE_LIMIT);assert.ok(rays<=SPAWN_CANDIDATE_LIMIT);
});
test('blocked respawns retry at 4 Hz in simulation time, then recover without overlap',()=>{
 const {g,a,world}=fixture();let checks=0;
 world.canOccupy=()=>{checks++;return false;};tickActionState(g,1/60);
 const first=checks;assert.ok(first>0);
 for(let i=1;i<15;i++){g.state.time=1+i/60;tickActionState(g,1/60);}
 assert.equal(checks,first);assert.equal(a.alive,false);
 world.canOccupy=()=>true;g.state.time=1+SPAWN_RETRY_SECONDS;tickActionState(g,1/60);
 assert.equal(a.alive,true);assert.equal(a.nextRespawnAttempt,0);
});
function firingFixture(){
 const a={id:'a',team:'analysts',alive:true,x:0,y:6,z:0,height:1.7,radius:.2,yaw:0,pitch:0};
 const e={...a,id:'enemy',team:'counterAnalysts',z:-10};
 const ally={...a,id:'ally',y:0,z:-5};
 return {a,e,ally,bot:{actor:a,target:{entity:e},game:{actors:[a,e,ally],hostages:[],config:{},state:{}}}};
}
test('3D fire discipline allows air-to-air shots over ground allies, blocks true intersections',()=>{
 const {bot,ally}=firingFixture();assert.equal(friendlyLineClear(bot),true);
 ally.y=6;assert.equal(friendlyLineClear(bot),false);
 ally.z=-15;assert.equal(friendlyLineClear(bot),true);
 ally.z=2;assert.equal(friendlyLineClear(bot),true);
});
test('fire discipline checks impending yaw/pitch and neutral bodies, including vertical shots',()=>{
 const {bot,a,e,ally}=firingFixture();ally.y=6;ally.x=5;ally.z=0;
 assert.equal(friendlyLineClear(bot),true);
 assert.equal(friendlyLineClear(bot,{yaw:-Math.PI/2}),false);
 ally.team=undefined;assert.equal(friendlyLineClear(bot,{yaw:-Math.PI/2}),false);
 Object.assign(e,{x:0,y:12,z:0});Object.assign(ally,{x:0,y:9,z:0});
 assert.equal(friendlyLineClear(bot,{pitch:Math.PI/2}),false);
 ally.y=0;assert.equal(friendlyLineClear(bot,{pitch:Math.PI/2}),true);
});
test('comfort preferences validate corrupt storage, clamp numeric values and survive denied storage',()=>{
 assert.deepEqual(readPreferences({getItem:()=>'{broken'}),sanitizePreferences());
 assert.deepEqual(readPreferences({getItem:()=> 'null'}),sanitizePreferences());
 const p=sanitizePreferences({sensitivity:100,fov:30,quality:'ultra',motion:'bogus'});
 assert.deepEqual(p,{sensitivity:2.5,fov:65,quality:'balanced',motion:'system'});
 assert.equal(sanitizePreferences({sensitivity:'NaN',fov:null}).sensitivity,1);
 const denied={getItem(){throw Error();},setItem(){throw Error();}};
 assert.equal(writePreferences(denied,p),false);assert.deepEqual(readPreferences(denied),sanitizePreferences());
 let saved;const store={setItem(k,v){saved=v;},getItem(){return saved;}};
 assert.equal(writePreferences(store,p),true);assert.deepEqual(readPreferences(store),p);
});
test('performance preset reduces backbuffer pixels and idle rendering never throttles play',()=>{
 assert.equal(pixelRatioFor('performance',true,3),.85);assert.equal(pixelRatioFor('balanced',true,3),1.25);
 assert.equal(pixelRatioFor('balanced',false,3),1.65);assert.equal(baseFov({fov:0},true),84);
 assert.equal(baseFov({fov:90},false),90);
 assert.equal(shouldRender(50,0,false,false),false);assert.equal(shouldRender(101,0,false,false),true);
 assert.equal(shouldRender(1,0,true,false),true);assert.equal(shouldRender(101,0,true,true),false);
});
test('death readout uses frozen recap, distinguishes blocked respawn and Classic, clears on life',()=>{
 const {g,a}=fixture();a.deathAt=0;a.respawnAt=2.7;
 a.combat={recap:{attacker:'C-02',weapon:'ar47',hits:3,damage:100}};
 const r=lifeReadout(g,WEAPONS);assert.equal(r.title,'UTSLAGEN AV C-02');assert.match(r.detail,/AR-47 · Totalt 3 träffar · 100 skada/);
 assert.ok(r.progress>0&&r.progress<1);
 g.state.time=3;assert.match(lifeReadout(g,WEAPONS).next,/ledig spawnplats/);
 a.respawnAt=null;assert.equal(lifeReadout(g,WEAPONS).next,'Nästa runda');
 a.alive=true;a.spawnProtectedUntil=4;assert.equal(lifeReadout(g,WEAPONS).kind,'protection');
 a.spawnProtectedUntil=0;assert.equal(lifeReadout(g,WEAPONS).kind,'hidden');
});

test('blocked spawn sampling advances to previously omitted safe nodes',()=>{
 const {g,a,world}=fixture();world.anchors.analysts=[{x:0,z:0}];
 world.navigation.nodes=Array.from({length:630},(_,i)=>({x:i/100,z:0}));
 world.canOccupy=x=>Math.abs(x-.01)<.00001;
 assert.equal(chooseRespawn(g,a),null);
 a.spawnRetryIndex=1;assert.equal(chooseRespawn(g,a).x,.01);
});
