/** Authored, continuous glove shells. Original geometry; no third-party art.
 * Three material batches per hand; shared meshes stay cosmetic and reusable.
 */
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
const resources = new Map(), retiredMaterials = new Set();
let materials;
function palette() {
  if (materials) return materials;
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
    const i=(y*64+x)*4, thread=((x+2*y)%5===0?165:212)+((x*7+y*11)%13);
    pixels[i]=pixels[i+1]=pixels[i+2]=thread; pixels[i+3]=255;
  }
  const weave = new THREE.DataTexture(pixels,64,64); weave.wrapS=weave.wrapT=THREE.RepeatWrapping;
  weave.repeat.set(3,3); weave.needsUpdate=true;
  materials = [
    new THREE.MeshStandardMaterial({color:0x56605a,roughness:.89,roughnessMap:weave,bumpMap:weave,bumpScale:.00035}),
    new THREE.MeshStandardMaterial({color:0x252e2c,roughness:.76}),
    new THREE.MeshStandardMaterial({color:0x7b8274,roughness:.95}),
  ];
  materials.forEach(m=>{m.userData.sharedWeapon=true;m.name='quality-glove';});
  materials.weave=weave; return materials;
}
function palm(side) {
  const rings=[[-.046,.019,.015],[-.032,.024,.019],[-.015,.029,.021],[.006,.031,.020],[.023,.029,.017],[.034,.022,.014],[.039,.008,.006]];
  const vertices=[],uv=[],indices=[],n=12;
  for(let row=0;row<rings.length;row++) for(let j=0;j<=n;j++) {
    const [y,rx,rz]=rings[row],a=j/n*Math.PI*2;
    vertices.push(Math.cos(a)*rx+side*.003,y,Math.sin(a)*rz+.003);
    uv.push(j/n,row/(rings.length-1));
  }
  for(let i=0;i<rings.length-1;i++) for(let j=0;j<n;j++) {
    const a=i*(n+1)+j,b=a+n+1; indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function curved(points,radius) {
  const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const steps=radius<.002?4:8,sides=radius<.002?4:6;
  const g=new THREE.TubeGeometry(c,steps,radius,sides,false),p=g.attributes.position;
  for(let i=0;i<=steps;i++) {
    const center=c.getPointAt(i/steps),taper=1-.20*(i/steps);
    for(let j=0;j<=sides;j++) { const k=i*(sides+1)+j;p.setXYZ(k,center.x+(p.getX(k)-center.x)*taper,center.y+(p.getY(k)-center.y)*taper,center.z+(p.getZ(k)-center.z)*taper); }
  }
  g.computeVertexNormals();return g;
}
function oval(x,y,z,rx,ry,rz) {const g=new THREE.SphereGeometry(1,8,6);g.scale(rx,ry,rz);g.translate(x,y,z);return g;}
function template(side,compact) {
  const key=side+':'+compact;if(resources.has(key))return resources.get(key);
  const buckets=[[],[],[]],mats=palette();buckets[0].push(palm(side));
  for(let i=0;i<3;i++) {
    const y=.008-i*.0158;
    buckets[0].push(curved([[side*.018,y,0],[side*.027,y,-.018],[side*.011,y,-.038],[-side*.015,y,-.039],[-side*.027,y,-.021]],.0068));
    buckets[1].push(oval(side*.019,y,-.020,.0072,.0064,.0064));
    buckets[2].push(curved([[side*.018,y+.005,.010],[side*.025,y+.004,-.006],[side*.022,y+.004,-.016]],.00075));
  }
  // Separate trigger/support index. Dimensions follow the existing attachment sockets.
  buckets[0].push(curved([[side*.019,.025,.002],[side*.025,.034,-.024],[side*.013,.030,-(compact?.055:.050)],[-side*.001,.016,-(compact?.056:.049)]],.0067));
  buckets[0].push(curved([[-side*.012,.028,.011],[-side*.026,.032,-.007],[-side*.029,.023,-.026],[-side*.019,.015,-.038]],.009));
  buckets[1].push(oval(side*.006,-.007,.022,.019,.026,.0022));
  for(let i=0;i<3;i++) buckets[1].push(oval(side*.006,.019-i*.015,.023,.022,.004,.003));
  const cuff=new THREE.CylinderGeometry(.026,.024,.019,12,1,true);cuff.scale(1,1,.76);cuff.translate(0,-.049,.003);buckets[1].push(cuff);
  buckets[2].push(curved([[-.021,-.036,.016],[0,-.037,.023],[.022,-.036,.016]],.00085));
  const parts=buckets.map((list,i)=>{
    const expanded=list.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(expanded,false);
    for(const g of new Set([...list,...expanded]))g.dispose();
    geometry.userData.sharedWeapon=true;geometry.computeBoundingSphere();return {geometry,material:mats[i]};
  });
  resources.set(key,parts);return parts;
}
function replace(old,side,compact) {
  if(!old?.parent)return null;
  // Reuse the exact attachment Group: hand references and reload sockets stay valid.
  // Remove the old meshes rather than adding hidden geometry to every viewmodel.
  old.traverse(child=>{
    if(child.geometry&&!child.geometry.userData.sharedWeapon)child.geometry.dispose();
    for(const mat of Array.isArray(child.material)?child.material:[child.material])if(mat)retiredMaterials.add(mat);
  });
  old.clear();old.visible=true;old.userData.presentationGlove=true;
  for(const part of template(side,compact)){
    const m=new THREE.Mesh(part.geometry,part.material);m.castShadow=false;m.receiveShadow=true;
    m.updateMatrix();m.matrixAutoUpdate=false;old.add(m);
  }
  return old;
}
export function fitPresentationHands(model) {
  if(!model.userData.viewmodel)return;
  const compact=['p9','p12'].includes(model.userData.id);
  const right=model.getObjectByName('p9-trigger-hand')||model.getObjectByName('right-glove');
  const left=model.getObjectByName('p9-support-hand')||model.getObjectByName('left-glove');
  model.userData.presentationHands={right:replace(right,1,compact),left:replace(left,-1,compact)};
}
export function disposePresentationHands() {
  for(const parts of resources.values())for(const part of parts)part.geometry.dispose();resources.clear();
  for(const mat of retiredMaterials)mat.dispose();retiredMaterials.clear();
  if(materials){materials.weave.dispose();materials.forEach(m=>m.dispose());materials=null;}
}
