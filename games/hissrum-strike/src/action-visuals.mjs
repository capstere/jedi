/** Bounded cosmetic effects and adult fantasy dwarfs; reads authoritative hit/death state; never writes game state. */
import {smoothstep} from './fps/riposte-fps-math.mjs';
import * as T from 'three';
import {RoundedBoxGeometry} from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from '../vendor/three/addons/utils/BufferGeometryUtils.js';
const up=new T.Vector3(0,1,0);
function dwarfTemplate(variant){
 const root=new T.Group(),torso=new T.Group();root.add(torso);
 const cloth=[0x376a73,0x754649,0x8a6c32,0x4d6653,0x55486f][variant];
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.88});
 const M={cloth:mat(cloth),skin:mat([0xcfa27c,0xc68d66,0xa67151,0xd7b294,0xbf936f][variant]),beard:mat([0xd1c9b7,0x593b29,0xaca69b,0x815f40,0xd6d5cf][variant]),dark:mat(0x263033),metal:mat(0xb19b6f),eye:mat(0x17232a)};
 const put=(parent,geo,m,x,y,z,scale)=>{const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);if(scale)mesh.scale.set(...scale);parent.add(mesh);return mesh;};
 const sphere=(parent,m,x,y,z,scale)=>put(parent,new T.SphereGeometry(1,16,12),m,x,y,z,scale);
 put(torso,new RoundedBoxGeometry(.26,.27,.18,3,.065),M.cloth,0,.34,0);
 sphere(torso,M.skin,0,.57,-.008,[.122,.13,.108]);
 sphere(torso,M.beard,0,.465,-.083,[.135,.145,.09]);
 for(let i=-1;i<=1;i++)sphere(torso,M.beard,i*.055,.40,-.10,[.046,.09,.043]);
 sphere(torso,M.skin,0,.558,-.117,[.041,.034,.038]);
 for(const sign of[-1,1]){
  sphere(torso,M.skin,sign*.12,.565,0,[.026,.039,.027]);
  sphere(torso,M.eye,sign*.047,.592,-.106,[.012,.012,.006]);
  const brow=put(torso,new T.CapsuleGeometry(.009,.045,3,8),M.beard,sign*.048,.614,-.107);brow.rotation.z=sign*1.38;
 }
 const brim=put(torso,new T.CylinderGeometry(.14,.14,.025,20),M.dark,0,.675,0);
 const hat=put(torso,new T.ConeGeometry(.122,.20,20),M.cloth,0,.763,.008);hat.rotation.z=(variant-2)*.08;
 put(torso,new T.BoxGeometry(.27,.035,.19),M.dark,0,.285,0);
 put(torso,new RoundedBoxGeometry(.044,.041,.014,2,.007),M.metal,0,.286,-.103);
 const legs=[],arms=[];
 for(const sign of[-1,1]){
  const leg=new T.Group();root.add(leg);leg.position.set(sign*.073,.23,0);
  put(leg,new T.CapsuleGeometry(.049,.09,4,10),M.dark,0,-.065,0);
  put(leg,new RoundedBoxGeometry(.112,.08,.17,3,.025),M.dark,0,-.192,-.027);legs.push(leg);
  const arm=new T.Group();root.add(arm);arm.position.set(sign*.153,.43,0);
  put(arm,new T.CapsuleGeometry(.043,.105,4,10),M.cloth,sign*.01,-.063,0);
  sphere(arm,M.skin,sign*.015,-.153,-.006,[.045,.049,.041]);arms.push(arm);
 }
 // Merge each rigid joint by material; cloned instances share the resulting buffers.
 for(const group of[torso,...legs,...arms]){
  group.updateMatrix();const groups=new Map();
  for(const mesh of group.children){mesh.updateMatrix();const geo=mesh.geometry.toNonIndexed().applyMatrix4(mesh.matrix);if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(geo);mesh.geometry.dispose();}
  group.clear();for(const[m,parts]of groups){group.add(new T.Mesh(mergeGeometries(parts),m));parts.forEach(g=>g.dispose());}
 }
 root.userData={};return root;
}
function cloneDwarf(template){
 const root=template.clone(true);root.userData={torso:root.children[0],legs:[root.children[1],root.children[3]],arms:[root.children[2],root.children[4]]};return root;
}
function puffMap(){
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);
 r.addColorStop(0,'rgba(255,255,255,.65)');r.addColorStop(.45,'rgba(255,255,255,.36)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);
}
export class ActionVisuals{
 constructor(scene,world){
  this.scene=scene;this.world=world;this.root=new T.Group();this.root.name='action-presentation';scene.add(this.root);
  this.templates=Array.from({length:5},(_,i)=>dwarfTemplate(i));this.dwarfs=new Map();this.rockets=new Map();this.particles=[];this.time=-1;this.lastTrail=-1;
  this.map=puffMap();this.puffMaterial=new T.MeshBasicMaterial({map:this.map,transparent:true,opacity:.7,depthWrite:false});
  this.puffs=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.puffMaterial,128);this.puffs.frustumCulled=false;this.puffs.count=0;this.root.add(this.puffs);
  this.light=new T.PointLight(0xffb65c,0,9,2);this.root.add(this.light);this.lightUntil=-1;
  this.rocketGeometry=new T.CapsuleGeometry(.045,.3,4,10);this.rocketMaterial=new T.MeshStandardMaterial({color:0x59624b,roughness:.45,metalness:.4});
  this.matrix=new T.Matrix4();this.position=new T.Vector3();this.scale=new T.Vector3();this.colour=new T.Color();
 }
 particle(p,time,{size=.2,duration=.6,velocity=[0,.4,0],colour=0xb5b3a5}={}){this.particles.push({x:p.x,y:p.y,z:p.z,born:time,duration,size,velocity,colour});if(this.particles.length>128)this.particles.shift();}
 events(events,game){
  for(const e of events){
   if(e.type==='rocket-explosion'){
    this.light.position.set(e.x,e.y,e.z);this.lightUntil=game.state.time+.32;
    for(let i=0;i<24;i++){const a=i*2.3999;this.particle(e,game.state.time,{size:.22+i%4*.14,duration:.6+i%5*.16,velocity:[Math.cos(a)*(1+i%3),.5+Math.sin(i)*1.2,Math.sin(a)*(1+i%3)],colour:i<7?0xffa341:0x6a706e});}
   }
   if(e.type==='impact'&&e.surface!=='carpet')for(let i=0;i<3;i++)this.particle(e,game.state.time,{size:.035,duration:.15+i*.035,velocity:[Math.sin(i*7)*1.2,.8+i*.3,Math.cos(i*7)*1.2],colour:0xf3cf8e});
  }
 }
 update(game,camera){
  const s=game.state,t=s.time;if(t<this.time)this.clear();this.time=t;
  const ids=new Set();
  for(const a of s.wanderers||[]){
   ids.add(a.id);let model=this.dwarfs.get(a.id);if(!model){model=cloneDwarf(this.templates[a.variant]);this.root.add(model);this.dwarfs.set(a.id,model);}
   model.visible=game.config.wanderers&&Math.hypot(camera.position.x-a.x,camera.position.z-a.z)<30;
   if(!model.visible)continue;
   model.position.set(a.x,a.y||0,a.z);model.rotation.set(0,a.yaw||0,0);
   if(a.alive===false){const fall=smoothstep(0,.55,t-a.deathAt);model.rotation.z=fall*1.45;model.position.y=.10*fall;model.visible=t-a.deathAt<9;continue;}
   const wave=Math.sin(a.steps*13),moving=a.moving>.03?1:0;
   model.userData.legs.forEach((p,i)=>p.rotation.x=wave*(i?-1:1)*.42*moving);
   model.userData.arms.forEach((p,i)=>p.rotation.x=-wave*(i?-1:1)*.30*moving);
   model.userData.torso.position.y=moving?Math.abs(wave)*.012:Math.sin(t*1.6+a.variant)*.004;
  }
  for(const[id,m]of this.dwarfs)if(!ids.has(id)){this.root.remove(m);this.dwarfs.delete(id);}
  const rocketIds=new Set();
  for(const r of s.projectiles||[]){
   rocketIds.add(r.id);let mesh=this.rockets.get(r.id);if(!mesh){mesh=new T.Mesh(this.rocketGeometry,this.rocketMaterial);this.root.add(mesh);this.rockets.set(r.id,mesh);}
   mesh.position.set(r.x,r.y,r.z);mesh.quaternion.setFromUnitVectors(up,new T.Vector3(r.vx,r.vy,r.vz).normalize());
   if(t-this.lastTrail>.035)this.particle(r,t,{size:.12,duration:.65,velocity:[0,.18,0],colour:0xb7b8ae});
  }
  if(t-this.lastTrail>.035)this.lastTrail=t;
  for(const[id,m]of this.rockets)if(!rocketIds.has(id)){this.root.remove(m);this.rockets.delete(id);}
  this.particles=this.particles.filter(p=>t-p.born<p.duration);
  let i=0;for(const p of this.particles){const age=t-p.born,f=age/p.duration;this.position.set(p.x+p.velocity[0]*age,p.y+p.velocity[1]*age,p.z+p.velocity[2]*age);const size=p.size*(1+f*1.9)*(1-f*.75);this.scale.setScalar(Math.max(0,size));this.matrix.compose(this.position,camera.quaternion,this.scale);this.puffs.setMatrixAt(i,this.matrix);this.colour.setHex(p.colour).multiplyScalar(1-f*.65);this.puffs.setColorAt(i++,this.colour);}
  this.puffs.count=i;this.puffs.instanceMatrix.needsUpdate=true;if(this.puffs.instanceColor)this.puffs.instanceColor.needsUpdate=true;
  this.light.intensity=Math.max(0,(this.lightUntil-t)/.32)*13;
 }
 clear(){for(const m of this.rockets.values())this.root.remove(m);this.rockets.clear();for(const m of this.dwarfs.values())this.root.remove(m);this.dwarfs.clear();this.particles=[];this.puffs.count=0;this.light.intensity=0;this.lightUntil=-1;}
 dispose(){this.clear();this.root.removeFromParent();const geos=new Set(),mats=new Set();for(const t of this.templates)t.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());this.map.dispose();this.puffMaterial.dispose();this.puffs.geometry.dispose();this.puffs.dispose();this.rocketGeometry.dispose();this.rocketMaterial.dispose();}
}
