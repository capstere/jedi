/** Bounded grenade preview; unchanged authoritative ballistics, reusable GPU data. */
import * as THREE from 'three';
import {grenadeTrajectory} from './fps/grenade-ballistics.mjs';
import {GrenadePreviewBuffer,canPreviewGrenade} from './grenade-preview-buffer.mjs';
const POOL_LIMIT=12;
const EMPTY_GRENADES=Object.freeze([]);
export class GrenadeView{
 constructor(scene,world){
  this.world=world;this.scene=scene;this.nextPreview=0;this.pointCount=0;
  this.lastTime=-Infinity;this.previewShown=false;this.disposed=false;
  this.preview=new GrenadePreviewBuffer(64);
  this.positions=this.preview.positions;
  this.buffer=new THREE.BufferGeometry();
  this.positionAttribute=new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage);
  this.distanceAttribute=new THREE.BufferAttribute(this.preview.distances,1).setUsage(THREE.DynamicDrawUsage);
  this.buffer.setAttribute('position',this.positionAttribute);
  this.buffer.setAttribute('lineDistance',this.distanceAttribute);
  this.buffer.setDrawRange(0,0);
  this.line=new THREE.Line(this.buffer,new THREE.LineDashedMaterial({color:0xffdf91,dashSize:.18,gapSize:.12,transparent:true,opacity:.82,depthWrite:false}));
  this.line.frustumCulled=false;this.line.visible=false;scene.add(this.line);
  this.end=new THREE.Mesh(new THREE.RingGeometry(.14,.21,20),new THREE.MeshBasicMaterial({color:0xffb06e,side:THREE.DoubleSide,depthWrite:false}));
  this.end.rotation.x=-Math.PI/2;this.end.visible=false;scene.add(this.end);
  this.geometry=new THREE.IcosahedronGeometry(.10,1);
  this.materials={he:new THREE.MeshStandardMaterial({color:0xe0a05e}),smoke:new THREE.MeshStandardMaterial({color:0xa8b9be}),flash:new THREE.MeshStandardMaterial({color:0xc7ebda})};
  this.live=new Map();this.pool=[];this.ids=new Set();
 }
 update(game,enabled=true){
  if(this.disposed)return;
  const p=game?.player,t=game?.state?.time??0;
  if(t<this.lastTime)this.clear(); // A new round can reset the simulation clock.
  this.lastTime=t;
  const show=canPreviewGrenade(game,enabled);
  if(show&&(!this.previewShown||t>=this.nextPreview)){
   this.nextPreview=t+.25;
   // Recompute collision at the existing 4 Hz cadence even while aim is
   // unchanged. Do not memoize the world: obstacles may be updated in future.
   const changed=this.preview.write(grenadeTrajectory(p,game.config,this.world));
   const count=this.preview.count;this.pointCount=count;
   if(changed){
    this.buffer.setDrawRange(0,count);
    if(count>0){
     // Attributes and backing arrays retain identity for the view lifetime.
     this.positionAttribute.clearUpdateRanges();this.positionAttribute.addUpdateRange(0,count*3);
     this.distanceAttribute.clearUpdateRanges();this.distanceAttribute.addUpdateRange(0,count);
     this.positionAttribute.needsUpdate=true;this.distanceAttribute.needsUpdate=true;
    }
   }
   if(count>0){const j=(count-1)*3;this.end.position.set(this.positions[j],this.positions[j+1]+.015,this.positions[j+2]);}
  }
  this.previewShown=show;
  this.line.visible=this.end.visible=show&&this.pointCount>1;
  if(!show){this.nextPreview=0;this.pointCount=0;}

  // Reuse the membership set, and return expired meshes before allocating for
  // this frame. Disabling the guide must NOT hide actually thrown grenades.
  const grenades=game?.state?.grenades??EMPTY_GRENADES;
  if(!grenades.length&&!this.live.size)return;
  this.ids.clear();for(const g of grenades)this.ids.add(g.id);
  for(const [id,mesh] of this.live)if(!this.ids.has(id)){
   this.release(mesh);this.live.delete(id);
  }
  for(const g of grenades){
   let mesh=this.live.get(g.id);
   if(!mesh){mesh=this.pool.pop()??new THREE.Mesh(this.geometry,this.materials.he);this.live.set(g.id,mesh);this.scene.add(mesh);}
   mesh.material=this.materials[g.type]??this.materials.he;
   mesh.visible=true;mesh.position.set(g.x,g.y,g.z);mesh.rotation.set(t*9,t*5,0);
  }
 }
 release(mesh){
  mesh.visible=false;mesh.removeFromParent();
  if(this.pool.length<POOL_LIMIT)this.pool.push(mesh);
 }
 clear(){
  this.line.visible=this.end.visible=false;this.pointCount=0;this.nextPreview=0;
  this.previewShown=false;this.lastTime=-Infinity;this.preview.reset();this.buffer.setDrawRange(0,0);
  for(const mesh of this.live.values())this.release(mesh);
  this.live.clear();this.ids.clear(); // Keep the bounded warm pool across restarts.
 }
 dispose(){
  if(this.disposed)return;
  this.clear();this.disposed=true;this.pool.length=0;
  this.line.removeFromParent();this.end.removeFromParent();
  this.buffer.dispose();this.line.material.dispose();
  this.end.geometry.dispose();this.end.material.dispose();this.geometry.dispose();
  for(const material of Object.values(this.materials))material.dispose();
 }
}
