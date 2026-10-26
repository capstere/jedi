import {EffectBatch} from './fx-pool.mjs';
import * as T from 'three';
const V=(p)=>new T.Vector3(p.x,p.y,p.z),UP=new T.Vector3(0,0,1);
const noise=(n)=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
function stamp(kind){const c=document.createElement('canvas');c.width=c.height=128;const p=c.getContext('2d');p.clearRect(0,0,128,128);if(kind==='blood'){
 // Irregular connected stain plus small satellite droplets. Avoid a radial
 // arrangement of repeated ellipses, which reads as a flower in close-up.
 p.fillStyle='rgba(112,4,9,.91)';p.beginPath();
 for(let i=0;i<=44;i++){const k=i%44,a=k/44*Math.PI*2,r=17+noise(k+301)*17,x=63+Math.cos(a)*r,y=65+Math.sin(a)*r*.79;if(i===0)p.moveTo(x,y);else p.lineTo(x,y);}p.closePath();p.fill();
 for(let i=0;i<67;i++){const a=noise(i+410)*Math.PI*2,r=10+Math.sqrt(noise(i+510))*46,x=63+Math.cos(a)*r,y=65+Math.sin(a)*r*.9,sz=.6+noise(i+610)*2.8;p.fillStyle=i%4?'rgba(126,5,10,.82)':'rgba(153,9,14,.7)';p.beginPath();p.ellipse(x,y,sz,sz*(.6+noise(i+710)),noise(i+810)*Math.PI,0,Math.PI*2);p.fill();}
}else{const g=p.createRadialGradient(64,64,2,64,64,60);g.addColorStop(0,'rgba(12,10,8,.95)');g.addColorStop(.2,'rgba(32,28,24,.9)');g.addColorStop(.42,'rgba(120,111,92,.5)');g.addColorStop(1,'rgba(80,75,70,0)');p.fillStyle=g;p.fillRect(0,0,128,128);for(let i=0;i<7;i++){p.strokeStyle='rgba(37,34,29,.8)';p.beginPath();p.moveTo(64,64);p.lineTo(64+Math.cos(i)*noise(i+20)*57,64+Math.sin(i)*noise(i+10)*57);p.stroke();}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
/** Cosmetic pools use their own event-derived random numbers, never gameplay RNG. */
export class CombatEffects{
 constructor(scene,world,settings){this.scene=scene;this.world=world;this.settings=settings;this.items=[];this.pool=[];this.moveScratch=new T.Vector3();this.directionScratch=new T.Vector3();this.attachmentRotation=new T.Quaternion();this.batches=new Map();this.seen=new Set();this.stats={blood:0,impacts:0,casings:0};this.geometry={bloodParticle:new T.PlaneGeometry(1,1),particle:new T.SphereGeometry(1,6,4),decal:new T.PlaneGeometry(1,1),casing:new T.CylinderGeometry(.012,.012,.065,6)};this.textures={blood:stamp('blood'),impact:stamp('impact')};this.materials={blood:new T.MeshBasicMaterial({map:this.textures.blood,color:0xffffff,transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide}),dust:new T.MeshBasicMaterial({color:0xb6aa92,transparent:true,opacity:.45,depthWrite:false}),casing:new T.MeshStandardMaterial({color:0xbda167,metalness:.78,roughness:.36}),bloodMark:new T.MeshBasicMaterial({map:this.textures.blood,color:0x9e353b,transparent:true,opacity:.98,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide}),impactMark:new T.MeshStandardMaterial({map:this.textures.impact,transparent:true,opacity:.85,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide})};
  for(const [kind,geo,mat,cap]of [['blood','bloodParticle','blood',384],['bloodMark','decal','bloodMark',160],['impactMark','decal','impactMark',120],['casing','casing','casing',52],['dust','particle','dust',64]])this.batches.set(kind,new EffectBatch(scene,this.geometry[geo],this.materials[mat],cap,kind));
 }
 add(kind,geometry,material,position,until,extra={}){
  const cap=kind==='blood'?384:kind==='bloodMark'?160:kind==='impactMark'?120:kind==='casing'?52:64;
  let batch=this.batches.get(kind);if(!batch){batch=new EffectBatch(this.scene,geometry,material,cap,kind);this.batches.set(kind,batch);}
  if(batch.active>=cap)this.recycle(this.items.find(it=>it.kind===kind));
  const mesh=batch.acquire();mesh.visible=true;mesh.position.set(position.x,position.y,position.z);mesh.rotation.set(0,0,0);mesh.scale.setScalar(1);
  const item={kind,mesh,until,batch,...extra};this.items.push(item);return item;
 }
 recycle(item){if(!item)return;item.batch.release(item.mesh);const index=this.items.indexOf(item);if(index>=0)this.items.splice(index,1);}
 mark(kind,hit,size,time){if(!hit?.point||!hit.normal)return null;const n=V(hit.normal).normalize(),p=V(hit.point);const basis=new T.Quaternion().setFromUnitVectors(UP,n),right=new T.Vector3(1,0,0).applyQuaternion(basis),up=new T.Vector3(0,1,0).applyQuaternion(basis);
  // Reject a stamp crossing a surface boundary instead of painting through walls.
  for(const [x,y]of [[-1,-1],[-1,1],[1,-1],[1,1]]){const q=p.clone().addScaledVector(right,x*size*.42).addScaledVector(up,y*size*.42).addScaledVector(n,.03);const check=this.world.raycast(q,n.clone().negate(),.065);if(!check||Math.abs(check.distance-.03)>.025)return null;}
  const item=this.add(kind,this.geometry.decal,this.materials[kind],p.clone().addScaledVector(n,.009),time+(kind==='bloodMark'?55:35),{surfaceId:hit.id,normal:hit.normal,point:hit.point});item.mesh.quaternion.copy(basis);item.mesh.scale.set(size,size,1);
  const box=this.world.doors?.boxes.find(b=>b.id===hit.id);
  if(box){const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-box.angle);item.attachment={box,position:item.mesh.position.clone().sub(new T.Vector3(box.x,box.y,box.z)).applyQuaternion(rotation),quaternion:rotation.multiply(item.mesh.quaternion)};}
  return item;
 }
 handle(events,game){const time=game.state.time,blood=this.settings.blood??'standard';for(const e of events){if(this.seen.has(e.serial))continue;this.seen.add(e.serial);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value);
  if(e.type==='damage'&&e.amount>0&&e.point&&blood!=='off'){this.stats.blood++;const n=blood==='reduced'?5:e.hp<=0?48:32,seed=e.serial||1,dir=e.direction?V(e.direction):new T.Vector3(0,0,1);for(let i=0;i<n;i++){const item=this.add('blood',this.geometry.bloodParticle,this.materials.blood,e.point,time+.40+noise(seed+i)*.40,{velocity:dir.clone().multiplyScalar(.45+noise(seed+i)*1.9).add(new T.Vector3((noise(seed+i+10)-.5)*2,noise(seed+i+20)*1.2,(noise(seed+i+30)-.5)*2))});item.mesh.scale.set(.06+noise(seed+i+40)*.085,.05+noise(seed+i+50)*.07,1);}
   const behind=this.world.raycast(V(e.point).addScaledVector(dir,.025),dir,2.4);if(behind)this.mark('bloodMark',behind,blood==='reduced'?.22:e.hp<=0?.95:.68,time);const floor=this.world.raycast(e.point,{x:0,y:-1,z:0},2.6);if(floor)this.mark('bloodMark',floor,blood==='reduced'?.19:e.hp<=0?.85:.58,time);
  }
  if(e.type==='impact'){this.stats.impacts++;const hit=e.normal?{point:{x:e.x,y:e.y,z:e.z},normal:e.normal,id:e.surfaceId??e.surface}:null;if(hit)this.mark('impactMark',hit,.12,time);for(let i=0;i<5;i++){const it=this.add('dust',this.geometry.particle,this.materials.dust,e,time+.22+noise(i+e.serial)*.2,{velocity:new T.Vector3((noise(i+7)-.5)*.6,.5,(noise(i+2)-.5)*.6)});it.mesh.scale.setScalar(.035);}}
  if(e.type==='shot'&&!['knife','bomb','smoke','flash','he','bazooka'].includes(e.weapon)){const actor=game.actors.find(a=>a.id===e.actorId);if(!actor)continue;this.stats.casings++;const p={x:actor.x+Math.cos(actor.yaw)*.23,y:actor.y+actor.height-.34,z:actor.z-Math.sin(actor.yaw)*.23};const item=this.add('casing',this.geometry.casing,this.materials.casing,p,time+24,{velocity:new T.Vector3(Math.cos(actor.yaw)*1.3,.8,-Math.sin(actor.yaw)*1.3),spin:e.serial||1});item.mesh.rotation.z=Math.PI/2;}
 }}
 update(time,dt,camera=null){if((this.settings.blood??'standard')==='off')for(const item of [...this.items])if(item.kind.startsWith('blood'))this.recycle(item);for(const it of [...this.items]){if(it.attachment){const a=it.attachment,b=a.box;this.attachmentRotation.set(0,Math.sin(b.angle/2),0,Math.cos(b.angle/2));it.mesh.position.copy(a.position).applyQuaternion(this.attachmentRotation);it.mesh.position.x+=b.x;it.mesh.position.y+=b.y;it.mesh.position.z+=b.z;it.mesh.quaternion.copy(this.attachmentRotation).multiply(a.quaternion);}
 if(camera&&it.kind==='blood')it.mesh.quaternion.copy(camera.quaternion);if(time>it.until){this.recycle(it);continue;}if(it.velocity&&dt>0){const move=this.moveScratch.copy(it.velocity).multiplyScalar(dt),len=move.length();const hit=len?this.world.raycast(it.mesh.position,this.directionScratch.copy(move).normalize(),len+.02):null;if(hit){it.mesh.position.copy(V(hit.point)).addScaledVector(V(hit.normal),.017);if(it.kind==='casing'){it.velocity=null;it.mesh.rotation.set(Math.PI/2,0,it.spin);}else this.recycle(it);}else{it.mesh.position.add(move);it.velocity.y-=dt*8;if(it.kind==='casing'){it.mesh.rotation.x+=dt*13;it.mesh.rotation.y+=dt*9;}}}}this.flush();}
 flush(){for(const b of this.batches.values())b.begin();for(const it of this.items)it.batch.write(it.mesh);for(const b of this.batches.values())b.flush();}
 clear(){for(const it of [...this.items])this.recycle(it);this.seen.clear();this.flush();this.stats={blood:0,impacts:0,casings:0};}
 dispose(){this.clear();for(const batch of this.batches.values())batch.dispose();this.batches.clear();for(const g of Object.values(this.geometry))g.dispose();for(const m of Object.values(this.materials))m.dispose();for(const t of Object.values(this.textures))t.dispose();this.pool=[];}
}
