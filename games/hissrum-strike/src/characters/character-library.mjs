/** Authored CC0 skinned actors, loaded locally before the Start button enables.
 * Original models: Quaternius. Uniform geometry and rest-space retargeting are
 * reproducible in tools/characters/build_assets.py. This owns no game state.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import {WEAPONS} from '../fps/config.mjs';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
let templates=null,pending=null;
const live=new Set();
export function charactersReady(){return !!templates;}
export function installCharacterTemplates(male,female){
 for(const asset of [male,female]){
  const clips=new Set(asset.animations.map(c=>c.name));
  for(const name of ['Idle_Loop','Walk_Loop','Crouch_Idle_Loop','Pistol_Idle_Loop','Pistol_Reload','Death01'])if(!clips.has(name))throw Error('Missing authored character clip: '+name);
  let skins=0;asset.scene.traverse(o=>{if(o.isSkinnedMesh){skins++;o.frustumCulled=false;}});if(skins<5)throw Error('Incomplete dressed skinned character');
 }
 templates={male,female};
}
export async function loadCharacterLibrary(){
 if(templates)return;if(pending)return pending;
 const loader=new GLTFLoader();
 pending=Promise.all(['male','female'].map(name=>loader.loadAsync(new URL(`../../assets/characters/quaternius-operator-${name}.glb`,import.meta.url).href)))
  .then(([male,female])=>installCharacterTemplates(male,female)).catch(e=>{pending=null;throw new Error('Karaktärsmodellerna kunde inte laddas: '+e.message);});
 return pending;
}
/** Clone the hierarchy AND each skeleton. Mesh buffers/textures remain shared. */
function cloneSkinned(source){
 const root=source.clone(true),map=new Map(),original=[],copies=[];source.traverse(n=>original.push(n));root.traverse(n=>copies.push(n));
 for(let i=0;i<original.length;i++)map.set(original[i],copies[i]);
 for(const [a,b]of map)if(a.isSkinnedMesh){b.skeleton=new T.Skeleton(a.skeleton.bones.map(bone=>map.get(bone)),a.skeleton.boneInverses.map(m=>m.clone()));b.bindMatrix.copy(a.bindMatrix);b.bindMatrixInverse.copy(a.bindMatrixInverse);b.frustumCulled=false;}
 return root;
}
const hash=id=>[...String(id)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);
function fabricTexture(){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#8a8a8a';g.fillRect(0,0,64,64);
 for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2){g.fillStyle=(x+y)%4?'#858585':'#929292';g.fillRect(x,y,1,2);}
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(60,60);t.anisotropy=2;return t;
}
let fabric=null;
const upperName=n=>/^(clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/.test(n);
function upperClip(clip){return new T.AnimationClip('upper-'+clip.name,clip.duration,clip.tracks.filter(t=>upperName(t.name.split('.')[0])).map(t=>t.clone()));}
function lowerClip(clip){return new T.AnimationClip('lower-'+clip.name,clip.duration,clip.tracks.filter(t=>!upperName(t.name.split('.')[0])).map(t=>t.clone()));}
export function createAuthoredAvatar(team,id,isHostage=false){
 if(!templates)throw Error('Character library must be loaded before actor creation');
 const seed=hash(id),gender=seed%3===0?'female':'male',asset=templates[gender],root=cloneSkinned(asset.scene),materials=new Map(),ownedGeometry=[],bones=new Map(),meshes=[],shoes=[];
 const palette=isHostage?{shirt:0xe0e7e2,pants:0x334552,vest:0xe4e7df,trim:0x468e8c}:team==='analysts'?{shirt:0x22435e,pants:0x202c3b,vest:0x132d42,trim:0x5aa8cf}:{shirt:0x9b967c,pants:0x454c3b,vest:0x505b42,trim:0xc9ad65};
 fabric??=fabricTexture();
 root.traverse(o=>{
  if(o.isBone)bones.set(o.name,o);
  if(!o.isMesh)return;meshes.push(o);o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;
  if(!materials.has(o.material)){
   const m=o.material.clone();m.userData.characterOwned=true;
   if(m.name==='jacket-fabric')m.color.setHex(palette.shirt);
   // One continuous suit hue avoids jagged triangle-colour borders at hips.
   if(m.name==='trousers-fabric')m.color.setHex(palette.shirt);
   if(m.name==='vest-shell')m.color.setHex(palette.shirt);
   if(m.name==='hair')m.color.setHex([0x261e19,0x49372a,0x796249,0x151b1c][seed%4]);
   if(m.name==='face-skin')m.color.setHex([0xffffff,0xe8d1b9,0xb18b71,0xc6a486][(seed>>>3)%4]);
   if(/fabric|vest/.test(m.name)&&fabric){m.bumpMap=fabric;m.bumpScale=.0008;}
   materials.set(o.material,m);
  }
  o.material=materials.get(o.material);
 });
 const standard=(color,roughness=.83,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});materials.set(m,m);return m;};
 const rubber=standard(0x161e24,.93),leather=standard(0x243039,.72),webbing=standard(palette.vest,.94),metal=standard(0x8b989c,.4,.65),trim=standard(palette.trim);
 root.updateMatrixWorld(true);
 const restPosition=bone=>bone.getWorldPosition(new T.Vector3());
 function attached(geometry,material,pos,bone,name){
  const mesh=new T.Mesh(geometry,material);ownedGeometry.push(geometry);mesh.name=name;mesh.position.copy(pos);root.add(mesh);root.updateMatrixWorld(true);bone.attach(mesh);mesh.castShadow=false;mesh.receiveShadow=true;meshes.push(mesh);return mesh;
 }
 const box=(size,mat,pos,bone,name)=>attached(new T.BoxGeometry(...size),mat,new T.Vector3(...pos),bone,name);
 for(const side of ['l','r']){
  const foot=bones.get('foot_'+side),p=restPosition(foot),x=p.x;
  const sole=attached(new RoundedBoxGeometry(.134,.035,.255,2,.012),rubber,new T.Vector3(x,.024,.044),foot,'boot-sole-'+side);
  attached(new RoundedBoxGeometry(.13,.105,.23,2,.028),leather,new T.Vector3(x,.083,.044),foot,'boot-shell-'+side);
  attached(new RoundedBoxGeometry(.113,.16,.125,2,.025),leather,new T.Vector3(x,.17,-.009),foot,'boot-shaft-'+side);
  for(let i=0;i<3;i++)box([.075,.006,.007],rubber,[x,.139,.025+i*.022],foot,'boot-lace');
  sole.geometry.computeBoundingBox();shoes.push(sole);
 }
 const pelvis=bones.get('pelvis'),chest=bones.get('spine_03'),head=bones.get('Head');
 if(!isHostage){
  attached(new RoundedBoxGeometry(.255,.285,.045,3,.028),webbing,new T.Vector3(0,1.29,.145),chest,'continuous-chest-rig');
  attached(new RoundedBoxGeometry(.24,.26,.035,3,.023),webbing,new T.Vector3(0,1.285,-.114),chest,'continuous-back-rig');
 }
 const belt=new T.TorusGeometry(.165,.016,5,24);belt.rotateX(Math.PI/2);belt.scale(1,1,.70);attached(belt,rubber,new T.Vector3(0,.957,0),pelvis,'duty-belt');
 box([.05,.032,.019],metal,[0,.956,.123],pelvis,'belt-buckle');
 for(const side of [-1,1]){
  box([.088,.115,.035],webbing,[side*.073,1.175,.162],chest,'vest-pocket');
  box([.095,.018,.041],trim,[side*.073,1.23,.168],chest,'pocket-flap');
  box([.026,.19,.018],webbing,[side*.135,1.355,.11],chest,'shoulder-webbing');
 }
 if(!isHostage){
  box([.047,.076,.033],rubber,[-.122,1.345,.153],chest,'radio');
  attached(new T.CylinderGeometry(.003,.003,.09,6),rubber,new T.Vector3(-.131,1.423,.153),chest,'radio-aerial');
  const hp=restPosition(head);
  for(const sign of [-1,1]){
   const ear=attached(new T.CylinderGeometry(.028,.028,.018,12),rubber,new T.Vector3(sign*.103,hp.y+.065,.0),head,'headset');
   const desired=new T.Quaternion().setFromEuler(new T.Euler(0,0,Math.PI/2));ear.quaternion.copy(head.getWorldQuaternion(new T.Quaternion()).invert().multiply(desired));
  }
 }
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#172a37';g.fillRect(0,0,512,256);g.fillStyle=isHostage?'#dbeae5':team==='analysts'?'#b3d8ec':'#eddfb9';g.fillRect(18,18,8,220);g.textAlign='center';g.font='bold 56px Arial';g.fillText(isHostage?'VISITOR':team==='analysts'?'ANALYSTS':'COUNTER',272,105);g.font='bold 43px Arial';g.fillText(isHostage?'05 / LAB':team==='analysts'?'QC / 05':'ANALYSTS',272,174);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=standard(0xffffff);m.map=tex;m.userData.ownedTexture=tex;
  attached(new T.PlaneGeometry(.205,.103),m,new T.Vector3(0,1.36,.177),chest,'chest-role-patch');
  const back=attached(new T.PlaneGeometry(.22,.11),m,new T.Vector3(0,1.37,-.145),chest,'back-role-patch');back.quaternion.copy(chest.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI)));
 }
 const mixer=new T.AnimationMixer(root),clips=new Map(asset.animations.map(c=>[c.name,c]));
 const base=new Map(),upper=new Map();for(const [name,clip]of clips){base.set(name,mixer.clipAction(isHostage?clip:lowerClip(clip)));if(!isHostage)upper.set(name,mixer.clipAction(upperClip(clip)));}
 const idle=base.get('Idle_Loop');idle.play();if(!isHostage)upper.get('Pistol_Idle_Loop').play();mixer.update(0);root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const holder=new T.Group();holder.name='authored-humanoid-'+gender;holder.rotation.y=Math.PI;holder.add(root);
 const bounds=posedBounds(root),scale=1.69/(bounds.max.y-bounds.min.y);holder.scale.setScalar(scale);holder.position.y=-bounds.min.y*scale+.004;
 const state={holder,root,bones,mixer,base,upper,clips,materials,meshes,shoes,scale,seed,gender,ownedGeometry,activeBase:'Idle_Loop',activeUpper:isHostage?null:'Pistol_Idle_Loop',time:null,x:null,z:null,motionSpeed:0,groundOffset:holder.position.y,isHostage,disposed:false,groundInverse:new T.Matrix4(),groundMatrix:new T.Matrix4(),hitBase:new T.Quaternion(),hitRotation:new T.Quaternion(),hitEuler:new T.Euler(),hitApplied:false};live.add(state);return state;
}
const v=new T.Vector3(),inv=new T.Matrix4();
/** Actual posed vertices, not the undeformed bind-pose AABB. Used at creation/death only. */
export function posedBounds(root){
 root.updateMatrixWorld(true);inv.copy(root.matrixWorld).invert();const b=new T.Box3();
 root.traverseVisible(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.skeleton.update();
  for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);b.expandByPoint(v);}
 });return b;
}
function play(state,map,name,active,fade=.16){
 if(state[active]===name)return;const next=map.get(name),prev=map.get(state[active]);if(!next)return;
 // Keep the planted/swinging foot at the same point when pace changes; restarting
 // every Walk/Jog threshold made a bot repeatedly put the same foot forward.
 const locomotion=active==='activeBase'&&/^(Walk|Jog|Sprint|Crouch_Fwd)/.test(name)&&/^(Walk|Jog|Sprint|Crouch_Fwd)/.test(state[active]||'');
 const phase=locomotion&&prev?(prev.time/prev.getClip().duration)%1:0;
 next.reset().setEffectiveWeight(1).play();if(locomotion)next.time=phase*next.getClip().duration;
 if(prev)next.crossFadeFrom(prev,fade,false);state[active]=name;
}
/** Time is simulation time. Repeated paused renders cannot advance clips. */
export function animateAuthored(state,actor,time,options={}){
 const elapsed=state.time===null?0:time-state.time,travel=state.x===null?0:Math.hypot(actor.x-state.x,actor.z-state.z),reset=elapsed<0||elapsed>.5||travel>2;
 const spine=state.bones.get('spine_03');
 // Remove last frame's additive reaction before the mixer evaluates. A paused
 // render must never accumulate a new bend in the already-posed skeleton.
 if(state.hitApplied){spine.quaternion.copy(state.hitBase);state.hitApplied=false;}
 if(reset){state.mixer.stopAllAction();state.activeBase=null;state.activeUpper=null;state.motionSpeed=0;state.holder.scale.setScalar(state.scale);state.holder.position.set(0,state.groundOffset,0);state.holder.rotation.set(0,Math.PI,0);}
 const crouch=actor.crouching||actor.height<1.3;
 // Hostage state intentionally has no `moving` field. Use its real displacement
 // so escorted visitors walk rather than slide in an idle pose.
 const speed=Math.max(0,Math.min(5,Number.isFinite(actor.moving)?actor.moving:!reset&&elapsed>0?travel/elapsed:state.motionSpeed));
 state.motionSpeed=speed;
 const previous=state.activeBase,walkThreshold=previous==='Idle_Loop'?.16:.08,jogThreshold=previous==='Jog_Fwd_Loop'?1.8:2.15,sprintThreshold=previous==='Sprint_Loop'?3.25:3.6;
 const name=actor.onGround===false?'Jump_Loop':crouch?(speed>(previous==='Crouch_Fwd_Loop'?.07:.16)?'Crouch_Fwd_Loop':'Crouch_Idle_Loop'):speed>sprintThreshold?'Sprint_Loop':speed>jogThreshold?'Jog_Fwd_Loop':speed>walkThreshold?'Walk_Loop':'Idle_Loop';
 play(state,state.base,name,'activeBase');const action=state.base.get(name);
 action.timeScale=/^(Walk|Jog|Sprint|Crouch_Fwd)/.test(name)?Math.min(1.65,speed/(crouch?1.2:name==='Walk_Loop'?1.4:name==='Jog_Fwd_Loop'?3:4.2)):1;
 if(!state.isHostage){
  const upper=actor.reloadUntil>time?'Pistol_Reload':time-(options.shotAt??-Infinity)<.14?'Pistol_Shoot':/^(knife|bomb|smoke|flash|he)$/.test(actor.weapon)?'Idle_Loop':'Pistol_Idle_Loop';
  play(state,state.upper,upper,'activeUpper',.10);
 }
 const delta=reset?0:Math.max(0,Math.min(.1,elapsed));
 // Presentation follows the true reload timer; it never changes ammunition.
 if(!state.isHostage&&actor.reloadUntil>time){
  const a=state.upper.get('Pistol_Reload'),duration=WEAPONS[actor.weapon]?.reload||1;
  const progress=Math.max(0,Math.min(1,1-(actor.reloadUntil-time)/duration));
  a.time=progress*Math.max(0,a.getClip().duration-.001);a.timeScale=0;
 }else if(!state.isHostage)state.upper.get('Pistol_Reload').timeScale=1;
 state.mixer.update(delta);
 const hurtAge=time-(actor.hurtTime??-Infinity);
 if(hurtAge>=0&&hurtAge<.30){
  const pulse=Math.sin(Math.PI*Math.min(1,hurtAge/.30))*Math.exp(-hurtAge*5),direction=actor.hurtDirection,yaw=actor.yaw||0;
  const dx=direction?.x||0,dz=direction?.z??-1,side=Math.cos(yaw)*dx-Math.sin(yaw)*dz,forward=Math.sin(yaw)*dx+Math.cos(yaw)*dz;
  state.hitBase.copy(spine.quaternion);state.hitEuler.set(forward*.12*pulse,0,-side*.12*pulse);
  spine.quaternion.multiply(state.hitRotation.setFromEuler(state.hitEuler));state.hitApplied=true;
 }
 state.time=time;state.x=actor.x;state.z=actor.z;
 state.holder.scale.setScalar(state.scale);state.holder.rotation.set(0,Math.PI,0);state.holder.position.set(0,0,0);
 state.holder.updateWorldMatrix(true,true);const rootInverse=state.groundInverse;rootInverse.identity();if(state.holder.parent)rootInverse.copy(state.holder.parent.matrixWorld).invert();let bottom=Infinity;
 for(const shoe of state.shoes){
  // Boot bounds are immutable. Transform only their lower support extent, with
  // cached matrices; do not rescan rounded-box vertices every actor/frame.
  const b=shoe.geometry.boundingBox,e=state.groundMatrix.multiplyMatrices(rootInverse,shoe.matrixWorld).elements;
  const centreX=(b.min.x+b.max.x)*.5,centreY=(b.min.y+b.max.y)*.5,centreZ=(b.min.z+b.max.z)*.5;
  const lower=e[1]*centreX+e[5]*centreY+e[9]*centreZ+e[13]-Math.abs(e[1])*(b.max.x-b.min.x)*.5-Math.abs(e[5])*(b.max.y-b.min.y)*.5-Math.abs(e[9])*(b.max.z-b.min.z)*.5;
  bottom=Math.min(bottom,lower);
 }
 if(Number.isFinite(bottom))state.holder.position.y=.004-bottom;
 state.holder.updateWorldMatrix(true,true);state.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
}
export function disposeAvatar(state){
 if(!state||state.disposed)return;state.disposed=true;state.mixer.stopAllAction();state.mixer.uncacheRoot(state.root);
 state.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const m of new Set(state.materials.values())){m.userData.ownedTexture?.dispose();m.dispose();}for(const g of state.ownedGeometry)g.dispose();live.delete(state);
}
export function disposeCharacterLibrary(){
 for(const state of [...live])disposeAvatar(state);const geometries=new Set(),materials=new Set(),textures=new Set();
 if(templates)for(const asset of Object.values(templates))asset.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
 for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();fabric?.dispose();fabric=null;templates=null;pending=null;
}
