import {Game} from '../src/fps/game.mjs';
import {tickCombat,controlObjective} from '../src/fps/combat-flow.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function runControlGeometryChecks(world){
 const g=new Game(world,{seed:42,config:{mode:'control',botFire:false,botFlight:true,agileFlight:true,wanderers:false,respawnDelay:2.7,spawnProtection:1.4}});
 g.start('analysts');const f=g.state.combatFlow;
 check(f.zones.length===3,'Hissrum needs three reachable, distinct zones');
 for(const z of f.zones){
  check(world.canOccupy(z.x,z.z,.38,1.72,0),'Zone is inside GLB collision');
  for(const team of ['analysts','counterAnalysts'])check(world.findPath(world.anchors[team][0],z).length,'Team cannot reach zone');
 }
 for(const a of g.actors.filter(a=>a.bot&&a.index!==4)){
  controlObjective(a.bot);check(a.bot.goal,'Capture bot has no objective route');
 }
 let captured=false;
 for(let step=0;step<3600;step++){
  g.update(1/60,{});
  if(g.drainEvents().some(e=>e.type==='control-captured'))captured=true;
  for(const a of g.actors.filter(a=>a.index===1||a.index===2))check(!a.flying,'Capture role abandoned the floor');
 }
 check(captured,'Bots never captured a zone during a full rotation');
 // Actual map capture checks at each zone, isolated from combat for determinism.
 for(const a of g.actors)a.alive=false;
 const p=g.player;Object.assign(p,{alive:true,onGround:true,spawnProtectedUntil:0});
 for(let i=0;i<f.zones.length;i++){
  f.index=i;Object.assign(f,{owner:null,capturing:null,progress:0,hold:0,rotateAt:g.state.time+60});
  Object.assign(p,{x:f.zones[i].x,y:0,z:f.zones[i].z});
  for(let n=0;n<190;n++){g.state.time+=1/60;tickCombat(g,1/60);}
  check(f.owner==='analysts','Standing inside real GLB zone failed to capture');
 }
 const score=g.state.score.analysts;g.damage(p,1000,null,'ar47');check(p.respawnAt>g.state.time,'Control death did not schedule respawn');
 for(let n=0;n<240;n++)g.update(1/60,{});
 check(p.alive,'Control player failed real-map respawn');check(g.state.score.analysts===score,'Death changed objective score');
 return {zones:f.zones.map(z=>({id:z.id,name:z.name,x:z.x,z:z.z})),autonomousCapture:captured,respawn:true};
}
