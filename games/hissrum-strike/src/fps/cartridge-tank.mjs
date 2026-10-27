/** One arcade Cartridge tank. All damage, movement and respawn use simulation
 * time and the original GLB collision model. Renderer never owns gameplay.
 * Dimensions/damage are game units, not a real vehicle or weapon design.
 */
import {rayBody,resetAutoAim} from './aim-controls.mjs';
import {freshRecoil} from './recoil.mjs';
export const TANK=Object.freeze({hp:900,height:1.85,radius:1.3,speed:7.5,
  reverse:3.5,acceleration:5,turn:1.55,cooldown:1.15,shellSpeed:25,
  directDamage:160,blastDamage:90,blastRadius:2.7,respawn:12,enterDistance:2.65});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const position=a=>({x:a.x,y:a.y||0,z:a.z});
const facing=(yaw,pitch=0)=>({x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});
const hostile=(a,b)=>a?.team&&b?.team&&a.team!==b.team;
const byId=(g,id)=>g.actors.find(a=>a.id===id);
export const drivingTank=(g,a=g.player)=>!!(a?.alive&&g.state.tank?.alive&&g.state.tank.driverId===a.id&&a.vehicleId==='cartridge-tank');
export function tankFits(world,x,z,yaw=0){
  // Three overlapping capsules describe the hull, swept in small steps. Never
  // substitute a tiny player capsule for the full tank beside real furniture.
  return [-.5,0,.5].every(offset=>world.canOccupy(
    x+Math.sin(yaw)*offset,z+Math.cos(yaw)*offset,.80,TANK.height,0));
}
export function tankRay(origin,dir,t,limit){
 if(!t?.alive)return null;
 const c=Math.cos(t.yaw),s=Math.sin(t.yaw),dx=origin.x-t.x,dz=origin.z-t.z;
 const o={x:dx*c-dz*s,y:origin.y-(t.y||0),z:dx*s+dz*c};
 const d={x:dir.x*c-dir.z*s,y:dir.y,z:dir.x*s+dir.z*c};
 let near=0,far=limit;
 for(const [axis,min,max]of [['x',-.78,.78],['y',.08,1.85],['z',-1.08,1.08]]){
  if(Math.abs(d[axis])<1e-9){if(o[axis]<min||o[axis]>max)return null;}
  else{let a=(min-o[axis])/d[axis],b=(max-o[axis])/d[axis];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}
 }
 return near<=limit?near:null;
}
export function initializeTank(g){
 g.state.tank=null;g.state.tankShells=[];
 for(const a of g.actors)a.vehicleId=null;
 if(!g.config.cartridgeTank)return;
 const home=g.world.anchors[g.team]?.[0]||g.world.navigation?.nodes?.[0];
 if(!home)return;
 const occupied=[...g.actors,...g.hostages];
 const nodes=(g.world.navigation?.nodes||[]).filter(n=>distance(n,home)>3&&distance(n,home)<12)
  .sort((a,b)=>Math.abs(distance(a,home)-5)-Math.abs(distance(b,home)-5));
 let pad=null;
 for(const n of nodes){
  if(occupied.some(a=>a.alive!==false&&distance(a,n)<2.0))continue;
  if(tankFits(g.world,n.x,n.z,0)&&tankFits(g.world,n.x,n.z,Math.PI/2)) {pad={x:n.x,y:0,z:n.z,yaw:0};break;}
 }
 if(!pad)throw Error('No safe Cartridge tank parking pad on the real Hissrum floor');
 const t=g.state.tank={...pad,id:'cartridge-tank',kind:'vehicle',name:'Cartridge-pansarvagn',
   home:Object.freeze({...pad}),radius:TANK.radius,height:TANK.height,hp:TANK.hp,maxHp:TANK.hp,
   alive:true,driverId:null,team:null,speed:0,turretYaw:0,pitch:0,nextShot:0,
   lastShot:-Infinity,hitAt:-Infinity,destroyedAt:null,respawnAt:null,generation:1,odometer:0};
 g.emit('tank-spawn',null,{...position(t),generation:t.generation});
}
function exitPoint(g,t,a){
 for(const radius of [1.7,2.2,2.7])for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI*.75,-Math.PI*.75]){
  const p={x:t.x+Math.sin(t.yaw+angle)*radius,y:0,z:t.z+Math.cos(t.yaw+angle)*radius};
  if(!g.world.canOccupy(p.x,p.z,a.radius,a.height,0))continue;
  if([...g.actors,...g.hostages].some(o=>o!==a&&o.alive!==false&&distance(p,o)<a.radius+(o.radius||.2)+.15))continue;
  if(!g.world.segmentClear({x:t.x,y:.9,z:t.z},{...p,y:.9},{vision:false}))continue;
  return p;
 }
 return null;
}
export function nearTank(g,a=g.player){
 const t=g.state.tank;
 return !!(a?.alive&&t?.alive&&!t.driverId&&a.y<.6&&distance(a,t)<TANK.enterDistance&&
 g.world.segmentClear({x:a.x,y:a.y+.9,z:a.z},{x:t.x,y:.9,z:t.z},{vision:false}));
}
export function toggleTank(g,a=g.player){
 const t=g.state.tank;
 if(g.state.paused||g.phase!=='active'||!a?.isPlayer||!a.alive||!t?.alive)return false;
 if(drivingTank(g,a)){
  const p=exitPoint(g,t,a);if(!p){g.emit('tank-exit-blocked',a);return false;}
  Object.assign(a,p,{vehicleId:null,vy:0,flying:false,moving:0,onGround:true});
  t.driverId=null;t.team=null;t.speed=0;resetAutoAim(a);a.aimRecoil=freshRecoil();
  g.emit('tank-exit',a);return true;
 }
 if(!nearTank(g,a)||a.action||g.hostages.some(h=>h.escortId===a.id))return false;
 a.vehicleId=t.id;a.flying=false;a.vy=0;a.crouching=false;a.height=g.config.standingHeight;
 a.reloadUntil=0;a.spawnProtectedUntil=0;a.action=null;a.aimRecoil=freshRecoil();resetAutoAim(a);
 Object.assign(a,position(t));t.driverId=a.id;t.team=a.team;t.turretYaw=a.yaw;t.pitch=0;
 t.nextShot=Math.max(t.nextShot,g.state.time+.3);g.emit('tank-enter',a);return true;
}
export function damageTank(g,t,amount,source,kind,context={}){
 if(!t?.alive||g.phase!=='active'||!Number.isFinite(amount)||amount<=0)return false;
 const driver=byId(g,t.driverId);
 if(driver&&source?.team===driver.team&&!g.config.friendlyFire)return false;
 const multiplier=['he','bazooka','cannon'].includes(kind)?1:.65;
 const dealt=Math.min(t.hp,amount*multiplier);t.hp-=dealt;t.hitAt=g.state.time;
 g.emit('tank-hit',null,{...position(t),amount:dealt,hp:t.hp,sourceId:source?.id});
 if(t.hp>0)return true;
 t.hp=0;t.alive=false;t.speed=0;t.destroyedAt=g.state.time;t.respawnAt=g.state.time+TANK.respawn;
 t.driverId=null;t.team=null;
 g.emit('tank-destroyed',null,{...position(t),respawnAt:t.respawnAt});
 g.emit('rocket-explosion',null,{...position(t),y:.8,radius:3.5});
 if(driver){
   driver.vehicleId=null;driver.spawnProtectedUntil=0;
   // A destroyed occupied tank kills its driver through the normal scoring,
   // Death01 and respawn pipeline. No separate fake kill event or extra reward.
   g.damage(driver,driver.hp+(driver.armor||0)+100,source,'tank-wreck',
     {...context,vehicleBypass:true,point:{x:driver.x,y:driver.y+.8,z:driver.z}});
 }
 return true;
}
function sweptDistance(a,b,p){
 const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z;
 const u=clamp(((p.x-a.x)*x+(p.z-a.z)*z)/(l||1),0,1);
 return Math.hypot(p.x-a.x-u*x,p.z-a.z-u*z);
}
export function controlTank(g,a,input,dt){
 const t=g.state.tank;if(!drivingTank(g,a))return;
 if(Number.isFinite(input.yaw))a.yaw=input.yaw;
 if(Number.isFinite(input.pitch))a.pitch=clamp(input.pitch,-.4,.75);
 t.turretYaw=a.yaw;t.pitch=a.pitch;
 const throttle=clamp(input.forward||0,-1,1),steer=clamp(input.strafe||0,-1,1);
 const desired=input.jump?0:throttle*(throttle<0?TANK.reverse:TANK.speed);
 t.speed+=(desired-t.speed)*Math.min(1,dt*TANK.acceleration);
 const yaw=t.yaw-steer*TANK.turn*dt;
 if(tankFits(g.world,t.x,t.z,yaw))t.yaw=yaw;
 const length=t.speed*dt,parts=Math.max(1,Math.ceil(Math.abs(length)/.16));
 for(let i=0;i<parts;i++){
  const before=position(t),next={x:t.x-Math.sin(t.yaw)*length/parts,y:0,z:t.z-Math.cos(t.yaw)*length/parts};
  if(!tankFits(g.world,next.x,next.z,t.yaw)){t.speed=0;break;}
  const bodies=[...g.actors,...g.hostages,...(g.state.wanderers||[])].filter(b=>b!==a&&b.alive!==false&&!b.rescued&&b.y<TANK.height&&b.y+b.height>0);
  const contacts=bodies.filter(b=>sweptDistance(before,next,b)<TANK.radius+(b.radius||.2));
  // Teammates, hostages and protected spawns are solid: never squash them.
  const blocked=contacts.some(b=>(!hostile(a,b)||b.spawnProtectedUntil>g.state.time||Math.abs(t.speed)<2)&&distance(next,b)<distance(before,b));
  if(blocked){t.speed=0;break;}
  t.x=next.x;t.z=next.z;t.odometer+=Math.abs(length/parts);
  for(const b of contacts)if(hostile(a,b)&&Math.abs(t.speed)>=2&&!(b.spawnProtectedUntil>g.state.time)&&g.world.segmentClear({...before,y:.7},{x:b.x,y:b.y+.7,z:b.z},{vision:false})){
    g.damage(b,240,a,'ram',{point:{x:b.x,y:b.y+.55,z:b.z},sourcePosition:{...before,y:.65},direction:facing(t.yaw)});
  }
 }
 Object.assign(a,position(t));a.moving=Math.abs(t.speed);a.vy=0;a.onGround=true;
 if(input.fire)fireTank(g,a);
}
export function fireTank(g,a=g.player){
 const t=g.state.tank;
 if(!drivingTank(g,a)||g.phase!=='active'||g.state.paused||g.state.time<t.nextShot)return false;
 t.nextShot=g.state.time+TANK.cooldown;t.lastShot=g.state.time;
 const dir=facing(t.turretYaw,t.pitch),origin={x:t.x,y:1.5,z:t.z};
 // Begin at the turret, not outside the wall at the muzzle: the swept shot
 // cannot emerge on the far side of a cart just because its barrel overlaps.
 const shell={...origin,dir,ownerId:a.id,id:'tank-shell-'+(++g.eventSerial),until:g.state.time+3.2};
 g.state.tankShells.push(shell);if(g.state.tankShells.length>8)g.state.tankShells.shift();
 g.emit('tank-fire',a,{...origin,dir});return true;
}
export function tickTank(g,dt){
 const t=g.state.tank;if(!t)return;
 if(t.driverId){const a=byId(g,t.driverId);if(!a?.alive||a.vehicleId!==t.id){t.driverId=null;t.team=null;t.speed=0;}}
 if(!t.alive&&g.state.time>=t.respawnAt){
  const obstructed=[...g.actors,...g.hostages,...(g.state.wanderers||[])].some(a=>a.alive!==false&&a.y<TANK.height&&distance(a,t.home)<TANK.radius+(a.radius||.2)+.15);
  if(!obstructed&&tankFits(g.world,t.home.x,t.home.z,t.home.yaw)){
   Object.assign(t,t.home,{alive:true,hp:TANK.hp,driverId:null,team:null,speed:0,
     turretYaw:0,pitch:0,lastShot:-Infinity,hitAt:-Infinity,destroyedAt:null,respawnAt:null,nextShot:g.state.time+1,generation:t.generation+1});
   g.emit('tank-spawn',null,{...position(t),generation:t.generation});
  }
 }
 const remaining=[];
 for(const s of g.state.tankShells||[]){
  const owner=byId(g,s.ownerId),len=TANK.shellSpeed*dt;
  const wall=g.world.raycast(s,s.dir,len,{vision:false});let travel=wall?.distance??len,hit=null;
  for(const b of [...g.actors,...g.hostages,...(g.state.wanderers||[])]){
   if(b.alive===false||b.rescued||b.id===s.ownerId)continue;
   const d=rayBody(s,s.dir,b,travel);if(d!==null&&d<travel){travel=d;hit=b;}
  }
  s.x+=s.dir.x*travel;s.y+=s.dir.y*travel;s.z+=s.dir.z*travel;
  if(wall||hit||g.state.time>=s.until||s.y<.04){
   const blast={x:s.x-s.dir.x*.08,y:Math.max(.08,s.y-s.dir.y*.08),z:s.z-s.dir.z*.08};
   g.emit('rocket-explosion',null,{...blast,radius:TANK.blastRadius,ownerId:s.ownerId});
   for(const b of g.actors){
    if(!b.alive||!hostile(owner,b))continue;
    const center={x:b.x,y:b.y+b.height*.5,z:b.z},d=Math.hypot(b.x-blast.x,center.y-blast.y,b.z-blast.z);
    if(b!==hit&&(d>=TANK.blastRadius||!g.world.segmentClear(blast,center,{vision:false})))continue;
    g.pendingDamage.push({target:b,amount:b===hit?TANK.directDamage:TANK.blastDamage*(1-d/TANK.blastRadius),source:owner,kind:'cannon',point:center,sourcePosition:blast,direction:s.dir});
   }
  }else remaining.push(s);
 }
 g.state.tankShells=remaining;
}
