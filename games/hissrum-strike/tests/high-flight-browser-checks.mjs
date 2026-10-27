import {createHissrumWorld} from '../src/world.mjs';
import {Game} from '../src/fps/game.mjs';
import {updateBotFlight} from '../src/fps/bot-flight.mjs';
import {AIR_PATROL} from '../src/fps/air-patrol.mjs';
const require=(ok,message)=>{if(!ok)throw Error(message);};

export async function runHighFlightChecks(suppliedWorld=null){
 const world=suppliedWorld||await createHissrumWorld(()=>{});
 const events=[];
 const g={world,state:{time:0},config:{botFlight:true,agileFlight:true,maxFlyingBots:4,
  botFlySpeed:4.5,standingHeight:1.7,crouchingHeight:1.08,botSpeed:3.2,
  runSpeed:4.6,sneakSpeed:1.65,crouchSpeed:1.35,gravity:18},
  actors:[],hostages:[],bomb:{status:'inactive'},
  emit:(type,actor)=>events.push({type,id:actor.id,at:g.state.time}),
  moveBody:Game.prototype.moveBody};
 for(const team of ['analysts','counterAnalysts'])for(let index=0;index<5;index++){
  const spawn=world.anchors[team][index];
  g.actors.push({...spawn,id:team+'-'+index,index,team,bot:{},alive:true,hp:100,
   height:1.7,radius:.2,pitch:0,vy:0,flying:false,moving:0,onGround:true,
   distanceWalked:0,lastStep:0,hurtTime:-Infinity});
 }
 const starts=g.actors.map(a=>({x:a.x,z:a.z}));
 let maxHeight=0,maxDisplacement=0,maxChecks=0,validSamples=0,maxFlying=0;
 for(let step=0;step<1350;step++){
  g.state.time+=1/30;
  for(const [i,actor] of g.actors.entries()){
   const controls={};updateBotFlight(g,actor,controls,1/30);
   Game.prototype.moveActor.call(g,actor,controls,1/30);
   maxHeight=Math.max(maxHeight,actor.y);
   maxDisplacement=Math.max(maxDisplacement,Math.hypot(actor.x-starts[i].x,actor.z-starts[i].z));
   maxChecks=Math.max(maxChecks,actor.airPatrol?.lastPlanChecks||0);
   if(step%15===0){
    require(world.canOccupy(actor.x,actor.z,actor.radius,actor.height,actor.y),
      'High bot entered real GLB furniture/wall/roof: '+actor.id);
    validSamples++;
   }
  }
  const flyers=g.actors.filter(a=>a.flying).length;
  maxFlying=Math.max(maxFlying,flyers);require(flyers<=4,'Flight cap exceeded');
 }
 const tookOff=new Set(events.filter(e=>e.type==='bot-takeoff').map(e=>e.id));
 require(tookOff.size>=7,'Flight slots starved most bots');
 require(maxHeight>=6&&maxHeight<=10.2,'Actual model high-flight band not reached/bounded');
 require(maxDisplacement>=18,'Bots still hover around their start instead of travelling');
 require(maxChecks<=AIR_PATROL.maxChecks,'Route-check budget exceeded');
 require(events.some(e=>e.type==='bot-landed'),'No real model landing completed');
 require(g.actors.every(a=>a.hp===100),'Patrol should not alter health');

 // Same map, guns, health, fixed-step gameplay, no human shooting. The legacy
 // adapter is retained for maps without declared bounds; methods still close
 // over the SAME original GLB collision geometry. This is a small behavioral
 // sample, not a guarantee of fewer eliminations in every player's match.
 const matches=[];
 for(const proactive of [false,true])for(const seed of [21,42,83]){
  const adapter={...world};
  const game=new Game(adapter,{seed,difficulty:'normal',config:{mode:'endless',buyTime:0,
   loadout:'smg',botFlight:true,agileFlight:true,maxFlyingBots:4,botFlySpeed:4.5,
   tacticalAI:true,wanderers:false,respawnDelay:2.7,spawnProtection:1.4}});
  game.start('analysts');
  if(!proactive)delete adapter.bounds;
  let peak=0,range=0;
  for(let frame=0;frame<1800;frame++){
   game.update(1/60,{});
   for(const actor of game.actors){
    if(!actor.bot)continue;
    peak=Math.max(peak,actor.y);
    const home=world.anchors[actor.team][actor.index];
    range=Math.max(range,Math.hypot(actor.x-home.x,actor.z-home.z));
   }
   game.drainEvents();
  }
  if(proactive)require(peak>=6,'Real Game failed to enable high patrols');
  matches.push({proactive,seed,seconds:30,
   botDeaths:game.actors.filter(a=>a.bot).reduce((n,a)=>n+a.deaths,0),
   peakHeight:+peak.toFixed(2),maxDisplacement:+range.toFixed(2)});
 }
 return {validCollisionSamples:validSamples,botsTakingInitiative:tookOff.size,maxFlying,
  maxHeight:+maxHeight.toFixed(2),maxDisplacement:+maxDisplacement.toFixed(2),maxChecks,
  landings:events.filter(e=>e.type==='bot-landed').length,matches};
}
