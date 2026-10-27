/** Bounded grenade preview; uses the same ballistic integration as Game. */
import * as THREE from 'three';
import {grenadeTrajectory} from './fps/grenade-ballistics.mjs';
export class GrenadeView{
 constructor(scene,world){
  this.world=world;this.scene=scene;this.nextPreview=0;this.pointCount=0;
  this.buffer=new THREE.BufferGeometry();this.positions=new Float32Array(64*3);
  this.buffer.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
  this.line=new THREE.Line(this.buffer,new THREE.LineDashedMaterial({color:0xffdf91,dashSize:.18,gapSize:.12,transparent:true,opacity:.82,depthWrite:false}));
  this.line.frustumCulled=false;this.line.visible=false;scene.add(this.line);
  this.end=new THREE.Mesh(new THREE.RingGeometry(.14,.21,20),new THREE.MeshBasicMaterial({color:0xffb06e,side:THREE.DoubleSide,depthWrite:false}));
  this.end.rotation.x=-Math.PI/2;this.end.visible=false;scene.add(this.end);
  this.geometry=new THREE.IcosahedronGeometry(.10,1);
  this.materials={he:new THREE.MeshStandardMaterial({color:0xe0a05e}),smoke:new THREE.MeshStandardMaterial({color:0xa8b9be}),flash:new THREE.MeshStandardMaterial({color:0xc7ebda})};
  this.live=new Map();this.pool=[];
 }
 update(game,enabled=true){
  const p=game?.player,t=game?.state.time??0;
  const show=enabled&&p?.alive&&['he','smoke','flash'].includes(p.weapon)&&p.inventory[p.weapon]>0;
  this.line.visible=this.end.visible=!!show;
  if(show&&t>=this.nextPreview){
   this.nextPreview=t+.25;
   const path=grenadeTrajectory(p,game.config,this.world).slice(0,64);
   for(let i=0;i<path.length;i++)this.positions.set([path[i].x,path[i].y,path[i].z],i*3);
   this.buffer.setDrawRange(0,path.length);this.buffer.attributes.position.needsUpdate=true;
   this.line.computeLineDistances();this.pointCount=path.length;
   const last=path.at(-1);this.end.position.set(last.x,last.y+.015,last.z);
  }
  if(!show){this.nextPreview=0;this.pointCount=0;}
  const ids=new Set();
  for(const g of game?.state.grenades??[]){
   ids.add(g.id);let mesh=this.live.get(g.id);
   if(!mesh){mesh=this.pool.pop()??new THREE.Mesh(this.geometry,this.materials.he);this.live.set(g.id,mesh);this.scene.add(mesh);}
   mesh.material=this.materials[g.type]??this.materials.he;
   mesh.visible=true;mesh.position.set(g.x,g.y,g.z);mesh.rotation.set(t*9,t*5,0);
  }
  for(const [id,mesh] of this.live)if(!ids.has(id)){
   mesh.visible=false;mesh.removeFromParent();this.live.delete(id);
   if(this.pool.length<12)this.pool.push(mesh);
  }
 }
 clear(){
  this.line.visible=this.end.visible=false;this.pointCount=0;this.nextPreview=0;
  for(const mesh of this.live.values()){mesh.visible=false;mesh.removeFromParent();}
  this.live.clear();this.pool=[];
 }
}
