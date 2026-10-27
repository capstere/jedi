import test from 'node:test';
import assert from 'node:assert/strict';
import {AIR_PATROL,patrolContact,planAirLeg,updateAirPatrol} from '../src/fps/air-patrol.mjs';
import {updateBotFlight} from '../src/fps/bot-flight.mjs';
import {Game} from '../src/fps/game.mjs';

function fixture(){
 const nodes=[];for(let x=-20;x<=20;x+=2)for(let z=-20;z<=20;z+=2)nodes.push({x,z});
 const a={id:'analysts-1',team:'analysts',index:1,bot:{},alive:true,hp:100,
  x:0,y:0,z:0,height:1.7,radius:.2,yaw:0,pitch:0,vy:0,moving:0,
  onGround:true,flying:false,distanceWalked:0,lastStep:0,hurtTime:-Infinity};
 const calls={occupy:0,events:[]};
 const world={bounds:{min:{x:-22,y:0,z:-22},max:{x:22,y:15,z:22}},
  navigation:{nodes,nearest:p=>nodes.reduce((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?b:a)},
  canOccupy:(x,z,r,h,y=0)=>{calls.occupy++;return Math.abs(x)<22-r&&Math.abs(z)<22-r&&y>=0&&y+h<15;},
  canStand:()=>true,segmentClear:()=>true,materialAt:()=> 'concrete'};
 const g={world,config:{botFlight:true,agileFlight:true,tacticalAI:true,maxFlyingBots:4,
  botFlySpeed:4.5,standingHeight:1.7,crouchingHeight:1.08,botSpeed:3.2,
  runSpeed:4.6,sneakSpeed:1.65,crouchSpeed:1.35,gravity:18},state:{time:0},
  bomb:{status:'inactive'},hostages:[],actors:[a],
  emit:(type,actor)=>calls.events.push({type,id:actor.id}),
  moveBody:(a,dx,dy,dz)=>{
   const y=Math.max(0,a.y+dy);
   if(world.canOccupy(a.x+dx,a.z+dz,a.radius,a.height,y)){a.x+=dx;a.y=y;a.z+=dz;}
   return {onGround:a.y===0};
  }};
 return {g,a,world,calls};
}
function tick(g,a,input={},dt=1/30){
 g.state.time+=dt;updateBotFlight(g,a,input,dt);Game.prototype.moveActor.call(g,a,input,dt);return input;
}

test('all agile bots take initiative without an enemy, rise high and traverse long legs',()=>{
 const {g,a,calls}=fixture();const start={x:a.x,z:a.z};let peak=0,range=0;
 for(let i=0;i<480;i++){
  tick(g,a);peak=Math.max(peak,a.y);range=Math.max(range,Math.hypot(a.x-start.x,a.z-start.z));
 }
 assert.ok(calls.events.some(e=>e.type==='bot-takeoff'));
 assert.ok(peak>=6,'bot must climb above the old 1–4 unit band');
 assert.ok(peak<=10.15,'altitude remains bounded');
 assert.ok(range>=12,'bot must leave its starting area, not oscillate locally');
 assert.ok(a.airPatrol.leg>=2,'patrol should chain more than one committed leg');
 assert.equal(a.hp,100,'movement cannot heal or grant health');
});

test('planner has fixed clearance budget and does not consume combat randomness',()=>{
 const {g,a,calls}=fixture();g.random=()=>{throw Error('flight changed combat RNG');};
 const result=planAirLeg(g,a,{leg:0,previous:null});
 assert.ok(result.point);assert.ok(result.distance>=AIR_PATROL.minLeg);
 assert.ok(result.checks<=AIR_PATROL.maxChecks);assert.equal(result.checks,calls.occupy);
});

test('low roofs constrain standing height and intervening ceilings reject unsafe climbs',()=>{
 const {g,a,world}=fixture();
 world.bounds.max.y=4;
 const plan=planAirLeg(g,a,{leg:0});
 assert.ok(plan.point&&plan.point.y+1.7<4,'low roof must lower the route');
 world.bounds.max.y=15;
 world.canOccupy=(x,z,r,h,y)=>y>=0&&y+h<2.15;
 const blocked=planAirLeg(g,a,{leg:0});
 assert.equal(blocked.point,null,'never ascend through a shelf to a clear destination');
});

test('blocked corridors do not become flight routes or teleport movement',()=>{
 const {g,a,world}=fixture();world.segmentClear=()=>false;
 const before=[a.x,a.y,a.z];
 for(let i=0;i<120;i++)tick(g,a);
 assert.equal(a.flying,false);assert.deepEqual([a.x,a.y,a.z],before);
 assert.ok(a.airPatrol.lastPlanChecks<=AIR_PATROL.maxChecks);
});

test('sightings use snapshots, expire and never access unseen entity coordinates',()=>{
 const hidden={get x(){throw Error('omniscience');},get z(){throw Error('omniscience');}};
 const bot={investigation:{entity:hidden,visible:false,timeLastSensed:9,lastSensedPosition:{x:8,y:2,z:3}}};
 assert.deepEqual(patrolContact(bot,10),{x:8,y:2,z:3});
 assert.equal(patrolContact(bot,16),null);
 bot.sharedContact={x:2,z:5,at:15};assert.equal(patrolContact(bot,16).x,2);
 bot.sharedContact.at=17;assert.equal(patrolContact(bot,16),null);
});

test('hurt/reloading flyers break away at altitude instead of immediately diving into fire',()=>{
 const {g,a}=fixture();
 for(let i=0;i<100;i++)tick(g,a);
 const hp=a.hp=25;a.hurtTime=g.state.time;
 a.bot.target={visible:true,lastSensedPosition:{x:a.x+3,y:a.y+1,z:a.z}};
 g.state.time=Math.max(g.state.time,a.airPatrol.nextPlan+.01);
 const command={fire:true};updateAirPatrol(g,a,command,1/30);
 assert.equal(a.airPatrol.mode,'flight');assert.equal(a.airPatrol.retreat,true);
 assert.equal(command.fire,false);assert.equal(a.hp,hp);
 assert.ok(Math.hypot(a.airPatrol.waypoint.x-a.bot.target.lastSensedPosition.x,
   a.airPatrol.waypoint.z-a.bot.target.lastSensedPosition.z)>8,'retreat keeps distance');
});

test('carrier/escort/objective urgency wins and flight is shared fairly within the cap',()=>{
 const {g,a}=fixture();g.bomb.carrierId=a.id;
 for(let i=0;i<50;i++)tick(g,a);assert.equal(a.flying,false);
 g.bomb.carrierId=null;
 const older={...a,id:'analysts-3',index:3,bot:{},airPatrol:null};g.actors.push(older);
 updateAirPatrol(g,older,{},1/30);older.airPatrol.nextAt=0;a.airPatrol.nextAt=.1;
 g.config.maxFlyingBots=1;g.state.time=5;
 updateAirPatrol(g,a,{},1/30);assert.equal(a.flying,false,'oldest waiting bot owns next slot');
 updateAirPatrol(g,older,{},1/30);assert.equal(older.flying,true);
 updateAirPatrol(g,a,{},1/30);assert.equal(a.flying,false,'concurrent cap must hold');
 older.y=5;g.bomb.carrierId=older.id;
 updateAirPatrol(g,older,{},1/30);assert.equal(older.airPatrol.mode,'landing');
});

test('landing has verified vertical clearance and does not drop through obstacles',()=>{
 const {g,a,world}=fixture();for(let i=0;i<100;i++)tick(g,a);
 a.y=6;g.state.time=a.airPatrol.until+.01;
 world.canOccupy=(x,z,r,h,y)=>y>=0&&y+h<15&&!(Math.abs(x-a.x)<.3&&Math.abs(z-a.z)<.3&&y<4);
 const input={};updateAirPatrol(g,a,input,1/30);
 assert.equal(a.airPatrol.mode,'landing');
 assert.equal(input.crouch,false,'move to a clear landing column before descending');
 assert.ok(Math.hypot(input.moveWorld.x,input.moveWorld.z)>0);
});

test('interrupted patrol resets on respawn, and a held leg is not planned every tick',()=>{
 const {g,a}=fixture();for(let i=0;i<45;i++)tick(g,a);
 const plans=a.airPatrol.plans;for(let i=0;i<20;i++)tick(g,a);
 assert.equal(a.airPatrol.plans,plans);
 a.flying=false;a.y=0;
 updateAirPatrol(g,a,{},1/30);assert.equal(a.airPatrol.mode,'ground');
 assert.ok(a.airPatrol.nextAt>g.state.time);
});
