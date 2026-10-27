import * as T from 'three';
import {CombatEffects} from '../src/effects.mjs';

const check=(ok,message)=>{if(!ok)throw new Error(message);};
const same=(a,b,message)=>check(JSON.stringify(a)===JSON.stringify(b),message);
const V=p=>new T.Vector3(p.x,p.y,p.z);

// Reference loop copied from capstere/jedi df2c1e1 src/effects.mjs.
// Only lifecycle/movement are overridden; shared event recipes are unchanged.
class LegacyEffects extends CombatEffects{
 recycle(item){if(!item)return;item.batch.release(item.mesh);const index=this.items.indexOf(item);if(index>=0)this.items.splice(index,1);}
 update(time,dt,camera=null){
  if((this.settings.blood??'standard')==='off')for(const item of [...this.items])if(item.kind.startsWith('blood'))this.recycle(item);
  for(const it of [...this.items]){
   if(it.attachment){const a=it.attachment,b=a.box;this.attachmentRotation.set(0,Math.sin(b.angle/2),0,Math.cos(b.angle/2));it.mesh.position.copy(a.position).applyQuaternion(this.attachmentRotation);it.mesh.position.x+=b.x;it.mesh.position.y+=b.y;it.mesh.position.z+=b.z;it.mesh.quaternion.copy(this.attachmentRotation).multiply(a.quaternion);}
   if(camera&&it.kind==='blood')it.mesh.quaternion.copy(camera.quaternion);
   if(time>it.until){this.recycle(it);continue;}
   if(it.velocity&&dt>0){
    const move=this.moveScratch.copy(it.velocity).multiplyScalar(dt),len=move.length();
    const hit=len?this.world.raycast(it.mesh.position,this.directionScratch.copy(move).normalize(),len+.02):null;
    if(hit){it.mesh.position.copy(V(hit.point)).addScaledVector(V(hit.normal),.017);if(it.kind==='casing'){it.velocity=null;it.mesh.rotation.set(Math.PI/2,0,it.spin);}else this.recycle(it);}
    else{it.mesh.position.add(move);it.velocity.y-=dt*8;if(it.kind==='casing'){it.mesh.rotation.x+=dt*13;it.mesh.rotation.y+=dt*9;}}
   }
  }
  this.flush();
 }
 clear(){for(const item of [...this.items])this.recycle(item);this.seen.clear();this.flush();this.stats={blood:0,impacts:0,casings:0};}
}
function fixture(Type=CombatEffects,blood='standard'){
 const rays=[],scene=new T.Scene(),settings={blood};
 const world={raycast(p,d,max){
  rays.push([p.x,p.y,p.z,d.x,d.y,d.z,max]);
  if(d.y>=0||p.y<0)return null;
  const distance=-p.y/d.y;
  if(distance>max)return null;
  return {id:'floor',distance,point:Object.freeze({x:p.x+d.x*distance,y:0,z:p.z+d.z*distance}),normal:Object.freeze({x:0,y:1,z:0})};
 }};
 return {fx:new Type(scene,world,settings),scene,settings,rays,world};
}
function state(f){
 return {
  items:f.fx.items.map(it=>[it.kind,it.until,it.mesh.position.toArray(),it.mesh.quaternion.toArray(),it.mesh.scale.toArray(),it.velocity?.toArray()??null]),
  batches:[...f.fx.batches].map(([kind,b])=>[kind,b.active,b.count,b.free.length,b.transforms,
    Array.from(b.mesh.instanceMatrix.array.slice(0,b.count*16))]),
  stats:f.fx.stats,rays:f.rays
 };
}
const game={state:{time:0},actors:[{id:'a',x:0,y:0,z:0,height:1.7,yaw:.7}]};
const events=[
 {type:'damage',serial:101,time:0,amount:28,hp:0,point:{x:0,y:.12,z:0},direction:{x:.4,y:-.2,z:.6}},
 {type:'impact',serial:102,time:0,x:1,y:0,z:1,normal:{x:0,y:1,z:0},surfaceId:'floor'},
 {type:'shot',serial:103,time:0,weapon:'ar47',actorId:'a'}
];

export function runCombatEffectChecks(){
 let parityFrames=0;
 for(const mode of ['standard','reduced']){
  const actual=fixture(CombatEffects,mode),reference=fixture(LegacyEffects,mode);
  const camera=new T.PerspectiveCamera();camera.rotation.set(.13,.7,0);
  const boxes=[];
  for(const f of [actual,reference]){
   f.fx.handle(events,game);f.fx.handle(events,game); // duplicate event protection
   const box={x:2,y:.5,z:-1,angle:0};boxes.push(box);
   f.fx.add('impactMark',f.fx.geometry.decal,f.fx.materials.impactMark,{x:2,y:1,z:-1},10,
    {attachment:{box,position:new T.Vector3(.2,.4,.1),quaternion:new T.Quaternion()}});
  }
  same(state(actual),state(reference),'event recipes differ before first frame');
  for(let i=0;i<24;i++){
   const time=i*.05,dt=i===0||i===9?0:.05;
   if(i===5){boxes[0].angle=boxes[1].angle=.67;boxes[0].x=boxes[1].x=2.3;}
   if(i===12)actual.settings.blood=reference.settings.blood='off';
   actual.fx.update(time,dt,camera);reference.fx.update(time,dt,camera);
   same(state(actual),state(reference),'FX differs from original at '+mode+' frame '+i);
   parityFrames++;
  }
  // Lifetime, settings, duplicate-event and reset behavior must remain identical.
  for(const time of [10,10.01,24,24.01,35,35.01,60]){
   actual.fx.update(time,0,camera);reference.fx.update(time,0,camera);
   same(state(actual),state(reference),'mark/casing lifetime differs at '+time);parityFrames++;
  }
  actual.fx.clear();reference.fx.clear();same(state(actual),state(reference),'clear differs');
  actual.fx.handle(events,game);reference.fx.handle(events,game);
  actual.fx.update(0,0,camera);reference.fx.update(0,0,camera);
  same(state(actual),state(reference),'new match cannot reuse old seen-event IDs');
  actual.fx.dispose();reference.fx.dispose();
 }

 const still=fixture(),fx=still.fx;
 for(let i=0;i<30;i++)fx.add('impactMark',fx.geometry.decal,fx.materials.impactMark,{x:i*.01,y:.01,z:0},Infinity);
 fx.update(0,0);const original=fx.items,markBatch=fx.batches.get('impactMark');
 const version=markBatch.mesh.instanceMatrix.version,attribute=markBatch.mesh.instanceMatrix;
 let iterations=0;
 const iterator=Array.prototype[Symbol.iterator];
 original[Symbol.iterator]=function(){iterations++;return iterator.call(this);};
 original.indexOf=original.splice=()=>{throw Error('per-frame linear search or splice');};
 for(let i=0;i<600;i++)fx.update(i/60,0);
 check(fx.items===original,'active effect array replaced');
 check(iterations===600,'only the existing flush traversal may iterate the array; no snapshot pass');
 check(markBatch.mesh.instanceMatrix===attribute&&attribute.version===version,'unchanged effects trigger GPU uploads');
 check(still.rays.length===0,'settled marks must not generate physics raycasts');
 fx.clear();check(fx.items===original&&original.length===0,'clear copies array or fails');
 delete original.indexOf;delete original.splice;delete original[Symbol.iterator];
 fx.dispose();

 const mass=fixture(),m=mass.fx;
 const limits={blood:384,bloodMark:160,impactMark:120,casing:52,dust:64};
 const geometry={blood:'bloodParticle',bloodMark:'decal',impactMark:'decal',casing:'casing',dust:'particle'};
 let released=0;
 for(const [kind,cap] of Object.entries(limits)){
  const b=m.batches.get(kind),release=b.release.bind(b);
  b.release=mesh=>{released++;release(mesh);};
  for(let i=0;i<cap;i++)m.add(kind,m.geometry[geometry[kind]],m.materials[kind],{x:0,y:1,z:0},0);
 }
 const total=Object.values(limits).reduce((a,b)=>a+b,0);
 check(m.items.length===total&&total===780,'batch capacities changed');
 m.items.indexOf=m.items.splice=()=>{throw Error('mass expiration uses repeated search/shifts');};
 m.update(1,.016);
 check(released===780&&m.items.length===0,'mass expiry not exactly once');
 for(const [kind,b] of m.batches)check(b.active===0&&b.mesh.count===0&&b.free.length===limits[kind],'incorrect retired pool '+kind);
 delete m.items.indexOf;delete m.items.splice;
 const first=m.add('casing',m.geometry.casing,m.materials.casing,{x:0,y:1,z:0},2);
 const slot=first.mesh;check(m.recycle(first)===true,'valid release failed');
 const next=m.add('casing',m.geometry.casing,m.materials.casing,{x:0,y:1,z:0},3);
 check(next.mesh===slot,'casing slot not reused');
 check(m.recycle(first)===false,'stale item released a currently reused slot');
 check(m.batches.get('casing').active===1&&next.mesh.visible,'stale reference corrupts pool');
 m.clear();m.clear();check(m.batches.get('casing').active===0,'repeat clear underflow');

 const resources=[...Object.values(m.geometry),...Object.values(m.materials),...Object.values(m.textures),...[...m.batches.values()].map(b=>b.mesh)];
 let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);
 m.dispose();m.dispose();m.update(4,.016);m.handle(events,game);
 check(disposed===resources.length&&resources.length===16,'shared resource cleanup must be exactly once');
 check(m.items.length===0&&mass.scene.children.length===0,'disposed effects remain in scene');
 return {parityFrames,unchangedFrames:600,activeListCopies:0,flushTraversals:iterations,
  unchangedUploadVersion:attribute.version===version,massExpired:total,staleReleaseRejected:true,resourcesDisposedOnce:disposed};
}
