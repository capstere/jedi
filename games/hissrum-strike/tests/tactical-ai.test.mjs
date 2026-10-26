import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseTactic,latestSquadContact,scoreTacticalPosition,planTacticalPosition} from '../src/fps/tactical-ai.mjs';
import {BotController} from '../src/fps/bots.mjs';
import {updateBotFlight} from '../src/fps/bot-flight.mjs';

function fixture(){
 const actor={id:'analysts-1',team:'analysts',index:1,isPlayer:false,
   x:0,z:0,y:0,hp:90,height:1.7,radius:.2,weapon:'ar47',
   reloadUntil:0,hurtTime:-Infinity,alive:true,lastStep:0};
 const nodes=[];
 for(let x=-8;x<=12;x+=2)for(let z=-8;z<=8;z+=2)
   nodes.push({x,z});
 const counts={line:0,path:0,occupancy:0};
 const world={
  navigation:{nodes,nearest:pos=>nodes.reduce((best,n)=>
    Math.hypot(n.x-pos.x,n.z-pos.z)<Math.hypot(best.x-pos.x,best.z-pos.z)?n:best,nodes[0])},
  inside:(x,z)=>Math.abs(x)<20&&Math.abs(z)<20,
  canOccupy:(x,z,r,h,y=0)=>{
   counts.occupancy++;return Math.abs(x)<19&&Math.abs(z)<19&&
     !(x>4&&x<6&&z>6&&z<8);
  },
  segmentClear:(a,b)=>{
   counts.line++;
   // Real-world stand-in: a short, solid cart blocks LOS on the centre aisle.
   return !(Math.min(a.x,b.x)<5&&Math.max(a.x,b.x)>5&&
     Math.abs(a.z)<1.6&&Math.abs(b.z)<1.6);
  },
  findPath:(start,p)=>{
   counts.path++;
   return p.z===8?[]:[{x:p.x,z:p.z}]; // z=8 is disconnected
  }
 };
 const game={world,actors:[actor],state:{time:10},config:{tacticalAI:true,botFlight:true,botSpeed:3.2},tacticalContacts:[],
   bomb:{status:'inactive',carrierId:'counter-0'},hostages:[],emit:()=>{}};
 return {actor,game,world,counts};
}
test('cover choices favor genuine occlusion and not exposed spray-and-pray',()=>{
 const {actor,game}=fixture(),target={x:10,z:0,y:1.0};
 const blocked={x:0,z:0},exposed={x:7,z:0};
 assert.ok(scoreTacticalPosition(game,actor,blocked,target,'cover')>
   scoreTacticalPosition(game,actor,exposed,target,'cover'));
 assert.equal(chooseTactic({...actor,hp:20,hurtTime:9},10), 'cover');
 assert.equal(chooseTactic({...actor,weapon:'sniper',reloadUntil:11},10),'cover');
 assert.equal(chooseTactic(actor,10),'flank');
 assert.equal(chooseTactic(actor,10,true),'objective');
});
test('flanking prefers sideways sight lines, rather than rushing straight ahead',()=>{
 const {actor,game}=fixture(),target={x:10,z:0,y:1.0};
 const exposed={x:2,z:0},flank={x:2,z:5};
 assert.ok(scoreTacticalPosition(game,actor,flank,target,'flank')>
   scoreTacticalPosition(game,actor,exposed,target,'flank'));
});
test('squad intelligence only uses recent, observed, same-team sightings',()=>{
 const {actor,game}=fixture();
 game.tacticalContacts=[
  {team:'counterAnalysts',x:15,z:15,at:9.9},
  {team:'analysts',x:4,z:-2,at:1.0}, // expired
  {team:'analysts',x:8,z:1,at:9.1},
  {team:'analysts',x:7,z:1,at:10.1}, // future, cannot use
  {team:'analysts',x:999,z:1,at:9.9} // outside room
 ];
 const known=latestSquadContact(game,actor);
 assert.equal(known.x,8);
 assert.equal(known.source,'team');
 game.tacticalContacts=[{team:'counterAnalysts',x:2,z:1,at:10}];
 assert.equal(latestSquadContact(game,actor),null,'no live enemy omniscience');
});
test('only navigable real-GLB nodes are selected, with bounded path checks',()=>{
 const {actor,game,counts}=fixture(),contact={x:11,z:0,y:1};
 const choice=planTacticalPosition(game,actor,contact,'flank');
 assert.ok(choice&&Number.isFinite(choice.x)&&Number.isFinite(choice.z));
 assert.notEqual(choice.z,8,'unreachable path must never be assigned');
 assert.ok(counts.path<=7,'pathfinding must have a per-decision budget');
 assert.ok(counts.line<=80,'raycast budget prevents rendering lag');
 assert.ok(game.world.canOccupy(choice.x,choice.z,.2,1.7,0));
});
test('bots avoid crowding on a teammate\'s assigned cover point',()=>{
 const {actor,game}=fixture(),target={x:10,z:0,y:1.0},p={x:1,z:4};
 const baseline=scoreTacticalPosition(game,actor,p,target,'flank');
 const friend={id:'analysts-4',team:'analysts',alive:true,x:1,z:4,
   bot:{tactical:{point:p,until:12}}};
 game.actors.push(friend);
 assert.ok(scoreTacticalPosition(game,actor,p,target,'flank')<baseline-5);
});
test('a bot commits to a cover/flank plan instead of replanning every tick',()=>{
 const {actor,game,counts}=fixture();
 const bot=Object.create(BotController.prototype);
 bot.game=game;bot.actor=actor;bot.path=[];bot.goal=null;
 bot.tactical=null;bot.nextTacticalPlan=0;bot.nextPath=0;
 const known={x:11,z:0,y:1};
 assert.equal(bot.tacticalPosition(known,'flank'),true);
 const oldPoint={...bot.tactical.point},originalCalls=counts.path;
 game.state.time+=.18;
 assert.equal(bot.tacticalPosition(known,'flank'),true);
 assert.deepEqual(bot.tactical.point,oldPoint);
 assert.equal(counts.path,originalCalls,'cached tactic must not rescan the model every AI tick');
});
test('tactical flight is a height-aware choice based on sightings, scout role and cover',()=>{
 const {actor,game,world}=fixture();
 actor.bot={target:null,investigation:null,sharedContact:null,tactical:null};
 actor.flying=false;actor.onGround=true;actor.vy=0;
 game.state.time=12;
 updateBotFlight(game,actor,{},1/60);
 assert.equal(actor.flying,false,'no random takeoff without contact or scout role');
 actor.bot.target={visible:true,lastSensedPosition:{x:9,y:1.1,z:2}};
 actor.bot.tactical={kind:'flank'};
 const input={};
 updateBotFlight(game,actor,input,1/60);
 assert.equal(actor.flying,true,'flankers use vertical vantage when they saw enemy');
 assert.ok(input.jump,'bot climbs using ordinary collision-aware flight');
 assert.ok(actor.airPatrol.goalY>0&&actor.airPatrol.goalY<=2.3);
 const next={...actor,id:'analysts-3',index:3,flying:false,hp:21,airPatrol:null,
   bot:{target:actor.bot.target,tactical:{kind:'cover'}}};
 game.actors=[actor,next];game.state.time=15;
 updateBotFlight(game,next,{},1/60);
 assert.equal(next.flying,false,'injured cover bots must not takeoff');
 actor.y=.9;actor.airPatrol.until=14;game.state.time=15;
 updateBotFlight(game,actor,{},1/60);
 assert.equal(actor.airPatrol.mode,'landing');
});
