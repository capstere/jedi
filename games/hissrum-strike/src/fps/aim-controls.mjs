/** Authoritative crosshair trigger. No aim assist, target snapping or wall vision.
 * Uses the same body intersection as Game.fire and the same re-coiled direction.
 * All timers are simulation seconds. Desktop never enables this input flag.
 */
const EPS=1e-8;
export const SNIPER_DWELL=.32;
export const isAutoFireWeapon=w=>!!w && ['primary','pistol'].includes(w.slot) && !w.projectile;
export function rayBody(origin,dir,actor,limit){
 const min={x:actor.x-actor.radius,y:actor.y+.04,z:actor.z-actor.radius};
 const max={x:actor.x+actor.radius,y:actor.y+actor.height,z:actor.z+actor.radius};
 let near=0,far=limit;
 for(const axis of ['x','y','z']){
  if(Math.abs(dir[axis])<EPS){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;}
  else{
   let a=(min[axis]-origin[axis])/dir[axis],b=(max[axis]-origin[axis])/dir[axis];
   if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
   if(near>far)return null;
  }
 }
 return near<=limit?near:null;
}
export function resetAutoAim(actor){actor.autoAim=null;actor.autoAimProgress=0;}
export function crosshairEnemy(game,actor,weapon){
 if(!actor?.alive || !isAutoFireWeapon(weapon))return null;
 const origin={x:actor.x,y:actor.y+actor.height-.12,z:actor.z};
 const dir={x:-Math.sin(actor.yaw)*Math.cos(actor.pitch),y:Math.sin(actor.pitch),z:-Math.cos(actor.yaw)*Math.cos(actor.pitch)};
 let nearest=game.world.raycast(origin,dir,weapon.range,{vision:false})?.distance??weapon.range;
 let body=null;
 const blocked=game.vehicleRay?.(origin,dir,nearest);
 if(blocked!==null&&blocked!==undefined)nearest=blocked;
 // Friends and noncombatants block the trigger even when friendly fire is OFF.
 for(const other of [...game.actors,...game.hostages,...(game.state.wanderers||[])]){
  if(other===actor||other.alive===false||other.rescued||other.vehicleId)continue;
  const hit=rayBody(origin,dir,other,nearest);
  if(hit!==null && hit<nearest){nearest=hit;body=other;}
 }
 if(!body?.team || body.team===actor.team || body.spawnProtectedUntil>game.state.time)return null;
 const point={x:origin.x+dir.x*nearest,y:origin.y+dir.y*nearest,z:origin.z+dir.z*nearest};
 if(!game.canSee(origin,point,true))return null; // opaque geometry AND smoke
 return body;
}
export function automaticTrigger(game,actor,weapon,enabled){
 const t=game.state.time;
 if(!enabled||!actor.isPlayer||game.state.paused||game.phase!=='active'||!actor.alive||
    actor.action||actor.reloadUntil>t||actor.flash>.3||!isAutoFireWeapon(weapon)||
    !(game.item(actor)?.ammo>0)){
  resetAutoAim(actor);return false;
 }
 const target=crosshairEnemy(game,actor,weapon);
 if(!target){resetAutoAim(actor);return false;}
 if(!actor.autoAim||actor.autoAim.id!==target.id||actor.autoAim.weapon!==actor.weapon){
  actor.autoAim={id:target.id,weapon:actor.weapon,since:t};
 }
 if(actor.weapon!=='sniper'){actor.autoAimProgress=1;return true;}
 actor.autoAimProgress=Math.min(1,Math.max(0,(t-actor.autoAim.since)/SNIPER_DWELL));
 return actor.autoAimProgress>=1-1e-7;
}
