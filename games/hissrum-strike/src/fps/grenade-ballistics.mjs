/** One ballistic integration for actual grenades and the optional aim preview. */
export function grenadeLaunch(actor,config){
 const pitch=actor.pitch+.15,speed=actor.isPlayer?(config.playerGrenadeSpeed??config.grenadeSpeed):config.grenadeSpeed;
 return {x:actor.x,y:actor.y+actor.height-.12,z:actor.z,
  vx:-Math.sin(actor.yaw)*Math.cos(pitch)*speed,
  vy:Math.sin(pitch)*speed+1.8,vz:-Math.cos(actor.yaw)*Math.cos(pitch)*speed,
  radius:config.grenadeRadius};
}
export function advanceGrenade(g,dt,world,gravity){
 g.vy-=gravity*dt;
 const dx=g.vx*dt,dy=g.vy*dt,dz=g.vz*dt,len=Math.hypot(dx,dy,dz);
 const dir=len?{x:dx/len,y:dy/len,z:dz/len}:{x:0,y:-1,z:0};
 const hit=world.raycast(g,dir,len+g.radius,{vision:false});
 let bounced=false;
 if(hit){
  const travel=Math.max(0,hit.distance-g.radius);
  g.x+=dir.x*travel;g.y+=dir.y*travel;g.z+=dir.z*travel;
  const n=hit.normal??{x:0,y:1,z:0},dot=g.vx*n.x+g.vy*n.y+g.vz*n.z;
  g.vx=(g.vx-1.6*dot*n.x)*.72;g.vy=(g.vy-1.6*dot*n.y)*.72;g.vz=(g.vz-1.6*dot*n.z)*.72;
  bounced=true;
 }else{g.x+=dx;g.y+=dy;g.z+=dz;}
 if(g.y<g.radius){g.y=g.radius;g.vy=Math.abs(g.vy)*.35;g.vx*=.82;g.vz*=.82;}
 return bounced;
}
export function grenadeTrajectory(actor,config,world){
 const g=grenadeLaunch(actor,config),points=[{x:g.x,y:g.y,z:g.z}];
 const dt=config.fixedStep??1/60,count=Math.min(180,Math.ceil(config.grenadeFuse/dt));
 for(let i=0;i<count;i++){
  advanceGrenade(g,dt,world,config.gravity);
  if(i%3===2||i===count-1)points.push({x:g.x,y:g.y,z:g.z});
 }
 return points;
}
