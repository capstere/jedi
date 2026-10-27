/** Strike Kit: original fictional P9/P12 + CR4 FIRST-PERSON geometry.
 * Replaces, rather than decorates, the old view weapons. Bare/world weapons,
 * cartridges, combat hit volumes and all game values remain the existing ones.
 * Art shapes only, not engineering/CAD or real firearm construction data.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import {createHandMaterials} from './hand-materials.mjs';
import {createKitHand,createKitSleeve,poseKitFingers,fitKitSleeve} from './strike-kit-hands.mjs';
import {WEAPONS} from './config.mjs';
import {kitWeapon,reloadPose,reloadPhase,reloadIsEmpty,smooth,envelope} from './strike-kit-timing.mjs';
const Y=new T.Vector3(0,1,0),owned=new Set();
const own=v=>(owned.add(v),v);
function mat(name,color,roughness=.65,metalness=0){const m=own(new T.MeshStandardMaterial({color,roughness,metalness}));m.name='strike-kit-'+name;m.userData.sharedWeapon=true;return m;}
let palette;
function materials(){
 if(palette)return palette;
 const a=new Uint8Array(128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const k=(y*128+x)*4,v=170+(x*13+y*29)%45;a[k]=a[k+1]=a[k+2]=v;a[k+3]=255;}
 const rough=own(new T.DataTexture(a,128,128));rough.wrapS=rough.wrapT=T.RepeatWrapping;rough.needsUpdate=true;
 palette={steel:mat('anodised-graphite',0x45515a,.34,.88),edge:mat('machined-edge',0xa3adb2,.27,.85),
 black:mat('rubber',0x111b22,.87),polymer:mat('sand-polymer',0x8b806c,.79,.02),
 inset:mat('deep-insets',0x0b1117,.68,.15),accent:mat('safety-mark',0xdca65f,.52,.18)};
 for(const m of Object.values(palette)){m.roughnessMap=rough;m.envMapIntensity=.85;}
 Object.assign(palette,createHandMaterials(own));return palette;
}
const group=(p,name)=>{const g=new T.Group();g.name=name;p?.add(g);return g;};
function mesh(p,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=false;o.receiveShadow=true;p.add(o);return o;}
function box(p,x,y,z,w,h,d,m,r=.003){return mesh(p,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.24,h*.24,d*.24)),m,x,y,z);}
function cyl(p,a,b,r1,r2,m,n=20){const u=new T.Vector3(...a),v=new T.Vector3(...b),d=v.clone().sub(u);const o=mesh(p,new T.CylinderGeometry(r2,r1,d.length(),n),m);o.position.copy(u.add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(Y,d.normalize());return o;}
function shape(p,points,w,m,r=.002){const s=new T.Shape();points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth:w,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,steps:1,curveSegments:8});g.rotateY(Math.PI/2);g.translate(-w/2,0,0);return mesh(p,g,m);}
function line(p,points,r,m){return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(12,points.length*4),r,8,false),m);}
function screw(p,x,y,z,m,axis='x'){
 const a=[x,y,z],b=[x,y,z];b[axis==='x'?0:axis==='y'?1:2]+=.0018;cyl(p,a,b,.0035,.0035,m,12);
}
function batch(part){
 const buckets=new Map();
 for(const c of [...part.children]){if(!c.isMesh)continue;c.updateMatrix();const geo=c.geometry.index?c.geometry.toNonIndexed():c.geometry.clone();geo.applyMatrix4(c.matrix);c.geometry.dispose();part.remove(c);if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));if(!buckets.has(c.material))buckets.set(c.material,[]);buckets.get(c.material).push(geo);}
 for(const[m,gs]of buckets){const geo=own(mergeGeometries(gs,false));gs.forEach(g=>g.dispose());geo.computeBoundingSphere();geo.userData.sharedWeapon=true;const o=mesh(part,geo,m);o.updateMatrix();o.matrixAutoUpdate=false;}
}
function rail(p,z0,z1,y,w,m){box(p,0,y,(z0+z1)/2,w,.011,Math.abs(z1-z0),m);const n=Math.floor(Math.abs(z1-z0)/.023);for(let i=0;i<n;i++)box(p,0,y+.009,z0+(z1-z0)*(i+.5)/n,w+.008,.008,.013,m,.001);}
function muzzle(p,z,y,r,m){
 // Hollow visible bore: open tube/rim, not a flat painted end cap.
 const tube=new T.CylinderGeometry(r,r,.040,24,1,true);tube.rotateX(Math.PI/2);mesh(p,tube,m.steel,0,y,z+.018);
 const rim=new T.TorusGeometry(r*.78,r*.22,8,24);mesh(p,rim,m.edge,0,y,z-.002);
 mesh(p,new T.CircleGeometry(r*.55,20),m.inset,0,y,z+.032).rotation.y=Math.PI;
}
function pistol(root,id,m){
 const gun=group(root,'weapon'),body=group(gun,'receiver'),slide=group(gun,'slide'),mag=group(gun,'magazine');
 // Sculpted continuous frame: dust cover, bevelled backstrap and undercut.
 shape(body,[[.061,.025],[-.159,.025],[-.177,.010],[-.177,-.017],[-.060,-.020],[-.046,-.034],[-.011,-.041],[.009,-.143],[.064,-.134],[.057,-.034]],.041,m.polymer,.004);
 shape(body,[[.008,-.041],[.049,-.034],[.060,-.128],[.017,-.137]],.044,m.black,.006);
 box(body,0,-.088,.066,.034,.090,.009,m.black,.003);
 for(const side of[-1,1]){
  const panel=shape(body,[[.014,-.058],[.042,-.047],[.052,-.121],[.023,-.128]],.003,m.polymer,.002);panel.position.x=side*.023;
  // Recessed diagonal stippling and a machined thumb shelf.
  for(let row=0;row<8;row++)for(let c=0;c<3;c++)box(body,side*.026,-.061-row*.008,.019+c*.010+row*.001,.0014,.0025,.006,m.black,.0003);
  box(body,side*.025,-.009,.006,.006,.008,.034,m.steel,.001);
  screw(body,side*.026,-.030,.028,m.edge);screw(body,side*.027,-.111,.041,m.inset);
 }
 line(body,[[0,-.025,-.058],[0,-.048,-.068],[0,-.069,-.051],[0,-.073,-.009],[0,-.053,.002]],.004,m.polymer);
 line(body,[[0,-.022,-.034],[0,-.045,-.039],[0,-.056,-.027]],.003,m.steel);
 // A split/chamfered slide with upper facets, not the inherited rounded block.
 shape(slide,[[.046,.029],[-.199,.029],[-.204,.038],[-.199,.068],[-.184,.079],[.027,.079],[.046,.065]],.042,m.steel,.0025);
 box(slide,0,.079,-.078,.027,.004,.204,m.black,.001);
 for(const side of[-1,1])for(const cluster of[.024,-.143])for(let i=0;i<6;i++){
  const cut=box(slide,side*.023,.050,cluster-i*.007,.0025,.026,.0028,m.inset,.0005);cut.rotation.x=-.17;
 }
 box(slide,.0236,.057,-.058,.0025,.023,.042,m.inset,.001);
 box(slide,.025,.049,-.056,.0018,.008,.034,m.edge,.0007);
 for(const z of[-.183,.027]){box(slide,0,.087,z,z<0?.012:.039,.014,.016,m.black,.0015);if(z>0)box(slide,0,.092,z+.001,.012,.009,.018,m.inset,.001);}
 box(slide,0,.090,-.174,.004,.004,.002,m.accent,.0005);
 for(const x of[-.013,.013])box(slide,x,.089,.037,.004,.004,.002,m.accent,.0005);
 cyl(body,[0,.047,-.12],[0,.047,-.207],.012,.012,m.edge);muzzle(body,-.214,.047,.012,m);
 mag.position.set(0,-.083,.032);box(mag,0,-.013,0,.030,.103,.037,m.steel);
 for(const side of[-1,1])for(let i=0;i<5;i++)box(mag,side*.0158,-.035+i*.014,.005,.001,.005,.005,m.inset,.0005);
 box(mag,0,-.068,0,.049,.012,.056,m.black,.003);
 for(const p of[body,slide,mag])batch(p);
 return {weapon:gun,magazine:mag,slide,muzzle:new T.Vector3(0,.047,-.220),grip:new T.Vector3(.039,-.074,.035),support:new T.Vector3(-.041,-.084,.044)};
}
function carbine(root,m){
 const gun=group(root,'weapon'),body=group(gun,'receiver'),mag=group(gun,'magazine'),bolt=group(gun,'bolt');
 shape(body,[[.067,.067],[-.219,.067],[-.237,.039],[-.225,-.023],[-.148,-.039],[-.132,-.067],[-.060,-.072],[-.046,-.035],[.060,-.035]],.056,m.steel,.003);
 shape(body,[[.046,-.031],[-.017,-.032],[-.001,-.155],[.049,-.165],[.064,-.145]],.041,m.polymer,.007);
 for(const side of[-1,1]){
  shape(body,[[-.185,-.012],[-.065,-.012],[-.058,-.064],[-.141,-.076],[-.18,-.058]],.003,m.polymer,.003).position.x=side*.031;
  box(body,side*.032,.035,-.076,.004,.026,.074,m.inset,.0015);
  box(body,side*.035,.030,-.075,.002,.010,.053,m.edge,.001);
  screw(body,side*.033,-.010,.014,m.edge);screw(body,side*.034,-.027,-.169,m.edge);
  cyl(body,[side*.031,-.014,-.025],[side*.036,-.014,-.025],.008,.008,m.black);
  box(body,side*.039,-.011,-.018,.003,.006,.024,m.edge,.001);
 }
 line(body,[[0,-.029,-.016],[0,-.073,-.023],[0,-.077,-.076],[0,-.061,-.096]],.0045,m.black);
 line(body,[[0,-.035,-.054],[0,-.060,-.059],[0,-.064,-.048]],.003,m.edge);
 // Tapered eight-sided handguard with actual open ventilation slots between ribs.
 const guard=group(body,'handguard');
 box(guard,0,.061,-.360,.052,.014,.264,m.polymer,.003);
 box(guard,0,-.021,-.360,.058,.017,.264,m.polymer,.004);
 for(const side of[-1,1]){
  box(guard,side*.035,.046,-.360,.012,.019,.264,m.polymer,.004);
  box(guard,side*.036,-.001,-.360,.012,.017,.264,m.polymer,.004);
  for(let i=0;i<8;i++)box(guard,side*.037,.023,-.241-i*.031,.012,.038,.012,m.polymer,.003);
 }
 cyl(guard,[0,.022,-.22],[0,.022,-.51],.012,.012,m.inset);
 for(const z of[-.232,-.480]){box(guard,0,.020,z,.083,.089,.020,m.black,.006);}
 rail(guard,-.242,-.486,.078,.044,m.steel);batch(guard);
 cyl(body,[0,.022,-.49],[0,.022,-.60],.011,.010,m.steel);muzzle(body,-.633,.022,.018,m);
 rail(body,.043,-.216,.081,.044,m.steel);
 // Fixed rear stock with a negative opening, stepped cheek pad and rubber heel.
 cyl(body,[0,.035,.06],[0,.035,.25],.019,.019,m.inset);
 shape(body,[[.135,.060],[.295,.044],[.300,-.116],[.261,-.132],[.229,-.046],[.135,-.022]],.054,m.polymer,.005);
 box(body,0,.046,.203,.067,.027,.120,m.black,.005);
 box(body,0,-.043,.301,.070,.174,.021,m.black,.005);
 for(let i=0;i<9;i++)box(body,0,-.111+i*.017,.313,.054,.003,.003,m.inset,.001);
 // Open iron sights so the aim line is not blocked by a solid chunk.
 for(const z of[.023,-.475]){box(body,0,.096,z,.043,.023,.023,m.black,.002);for(const side of[-1,1])box(body,side*.020,.119,z,.007,.031,.013,m.steel,.0015);}
 box(body,0,.119,-.475,.005,.020,.009,m.accent,.001);
 mag.position.set(0,-.065,-.128);
 shape(mag,[[.043,.016],[-.043,.016],[-.040,-.135],[-.024,-.179],[.047,-.167],[.051,-.129]],.045,m.black,.003);
 for(const side of[-1,1])for(let k=0;k<3;k++)line(mag,[[side*.024,-.016,-.027+k*.025],[side*.024,-.095,-.026+k*.025],[side*.024,-.151,-.010+k*.022]],.0027,m.polymer);
 box(mag,0,-.171,.012,.052,.012,.076,m.polymer,.002);
 box(bolt,.035,.035,-.034,.011,.010,.037,m.edge,.002);
 for(const p of[body,mag,bolt])batch(p);
 return {weapon:gun,magazine:mag,slide:bolt,muzzle:new T.Vector3(0,.022,-.645),grip:new T.Vector3(.039,-.105,.020),support:new T.Vector3(-.010,-.047,-.358)};
}

function palmBasis(u,v,n){return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...u),new T.Vector3(...v),new T.Vector3(...n)));}
const rightQ=palmBasis([0,-1,0],[0,0,-1],[1,0,0]),leftPistolQ=palmBasis([0,1,0],[0,0,-1],[-1,0,0]),leftRifleQ=palmBasis([0,0,-1],[1,0,0],[0,-1,0]);
const RIGHT_SHOULDER=new T.Vector3(.26,-.66,.32),LEFT_SHOULDER=new T.Vector3(-.30,-.35,.14);
export function makeKitWeapon(id){
 if(!kitWeapon(id))return null;
 const root=group(null,'weapon-'+id),m=materials(),rifle=id==='cr4',parts=rifle?carbine(root,m):pistol(root,id,m),arms=group(root,'viewmodel-arms');
 const right=createKitHand(arms,1,{material:m.glove,own}),left=createKitHand(arms,-1,{material:m.glove,own}),rightArm=createKitSleeve(arms,1,{material:m.cloth,own}),leftArm=createKitSleeve(arms,-1,{material:m.cloth,own});
 right.userData.weapon=id;left.userData.weapon=id;
 right.position.copy(parts.grip);right.quaternion.copy(rightQ);left.position.copy(parts.support);left.quaternion.copy(rifle?leftRifleQ:leftPistolQ);
 poseKitFingers(right,1,true);poseKitFingers(left,1);
 left.userData.home=left.position.clone();
 root.userData={...parts,id,viewmodel:true,heroKit:true,visualVariant:'strike-kit-authored-hands',arms,rightHand:right,leftHand:left,
  rightArm,leftArm,magazineHome:parts.magazine.position.clone(),magazineGrip:new T.Vector3(0,rifle?-.075:-.02,0),reloadGrip:new T.Vector3(),slideHome:parts.slide.position.clone(),
  viewSurfaces:{materials:8,kind:'new-authored-geometry-and-skinned-hands'},emptyReload:false,reloadToken:0,
  authored:'Original fictional game art. Not a real-weapon CAD model.'};
 animateKitWeapon(root,{alive:true,weapon:id,moving:0,reloadUntil:0,onGround:true},1,.016,{});return root;
}
export function animateKitWeapon(model,actor,time,dt,{shotAt=-Infinity,switchAt=-Infinity,reducedMotion=false,recoil=0}={}){
 const d=model.userData,rifle=d.id==='cr4',duration=WEAPONS[d.id].reload,reloading=actor.reloadUntil>time,p=reloadPhase(actor,d.id,time,duration);
 if(reloading&&d.reloadToken!==actor.reloadUntil){d.reloadToken=actor.reloadUntil;d.emptyReload=reloadIsEmpty(actor,d.id);}
 if(!reloading)d.reloadToken=0;
 const pose=reloadPose(p,{empty:d.emptyReload,rifle}),k=reloading?pose.lift:0;
 const shotAge=time-shotAt,shot=shotAge>=0&&shotAge<.18?Math.exp(-shotAge*30):0;
 const swap=1-smooth((time-switchAt)/.30),speed=Math.min(1,(actor.moving||0)/4.2),stride=(actor.distanceWalked||0)*8;
 model.position.set(rifle?.205:.17,(rifle?-.17:-.14)-swap*.23,rifle?-.64:-.54);
 model.rotation.set(-shot*(rifle?.025:.06)+swap*.40,.12,0);
 model.position.z+=shot*.022+recoil*.20;
 if(reloading){model.position.add(new T.Vector3(...pose.translation));model.rotation.x+=pose.rotation[0];model.rotation.y+=pose.rotation[1];model.rotation.z+=pose.rotation[2];}
 if(!reducedMotion){model.position.y+=Math.sin(stride)*speed*.003;model.rotation.z+=Math.cos(stride*.5)*speed*.006;}
 if(actor.action){model.position.y-=.11;model.rotation.x-=.18;}
 d.magazine.position.copy(d.magazineHome);d.magazine.rotation.set(0,0,0);d.magazine.visible=true;
 if(reloading){d.magazine.position.add(new T.Vector3(...pose.magPosition));d.magazine.rotation.set(...pose.magRotation);d.magazine.visible=!pose.hidden;}
 d.slide.position.copy(d.slideHome);d.slide.position.z+=shot*.036+(reloading&&d.emptyReload?pose.action*.033:0);
 d.leftHand.position.copy(d.support);d.leftHand.quaternion.copy(rifle?leftRifleQ:leftPistolQ);
 d.magazine.updateMatrix();d.reloadGrip.copy(d.magazineGrip).applyMatrix4(d.magazine.matrix);d.reloadGrip.x-=.029;
 if(reloading){
  d.leftHand.position.lerp(d.reloadGrip,pose.grip);
  d.leftHand.quaternion.slerp(leftPistolQ,pose.grip);
  if(pose.action>0){const boltGrip=new T.Vector3(-.032,.060,rifle?.034:.015);d.leftHand.position.lerp(boltGrip,pose.action);}
 }
 const curl=reloading&&p>.41&&p<.49?.50:1;poseKitFingers(d.leftHand,curl);poseKitFingers(d.rightHand,1,true);
 // A small trigger curl reacts only to confirmed shot events; never changes aim.
 {const b=d.rightHand.userData.fingers[0][1],u=b.userData;u.bend.setFromAxisAngle(u.flexAxis,u.curl-shot*.20);b.quaternion.copy(u.rest).multiply(u.bend);}
 fitKitSleeve(d.rightArm,d.rightHand,RIGHT_SHOULDER);
 fitKitSleeve(d.leftArm,d.leftHand,LEFT_SHOULDER);
 model.updateMatrixWorld(true);d.leftHand.userData.skin.skeleton.update();d.rightHand.userData.skin.skeleton.update();
 d.kitPose={progress:p,empty:d.emptyReload,reloading,magazineHidden:!d.magazine.visible};
 return {muzzle:model.localToWorld(d.muzzle.clone()),reloading};
}
export function disposeKitModels(){for(const r of owned)r.dispose?.();owned.clear();palette=null;}
