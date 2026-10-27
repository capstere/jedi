/** Original fictional rocket launcher geometry. No real-world construction data. */
import * as T from 'three';
import {mergeGeometries} from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
export function buildBazookaParts(parent){
 const mats={body:new T.MeshStandardMaterial({color:0x52614c,roughness:.62,metalness:.32}),steel:new T.MeshStandardMaterial({color:0x707c7d,roughness:.35,metalness:.8}),dark:new T.MeshStandardMaterial({color:0x172024,roughness:.82}),gold:new T.MeshStandardMaterial({color:0xc7a660,roughness:.5,metalness:.35}),glass:new T.MeshStandardMaterial({color:0x4ab0ba,emissive:0x226678,emissiveIntensity:.4,roughness:.2,metalness:.4})};
 const rigid=new T.Group();parent.add(rigid);
 const add=(geo,mat,x,y,z,rx=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.x=rx;rigid.add(m);return m;};
 const box=(x,y,z,w,h,d,mat)=>add(new RoundedBoxGeometry(w,h,d,2,.008),mat,x,y,z);
 add(new T.CylinderGeometry(.079,.079,.94,24,1,true),mats.body,0,.09,-.06,Math.PI/2);
 for(const z of[-.54,-.46,.15,.39])add(new T.TorusGeometry(.079,.012,8,24),mats.steel,0,.09,z);
 add(new T.CylinderGeometry(.064,.064,.065,24),mats.dark,0,.09,-.527,Math.PI/2);
 add(new T.CylinderGeometry(.035,.035,.07,18),mats.dark,0,.09,.4,Math.PI/2);
 for(const z of[-.38,-.35])add(new T.TorusGeometry(.08,.005,6,24),mats.gold,0,.09,z);
 box(0,-.052,-.025,.065,.23,.085,mats.dark);box(0,-.12,-.11,.085,.045,.12,mats.steel);
 box(0,.01,.28,.15,.14,.18,mats.dark);box(0,.015,-.27,.14,.065,.20,mats.dark);
 box(-.065,.17,-.12,.045,.09,.19,mats.steel);
 add(new T.CylinderGeometry(.028,.028,.20,16),mats.dark,-.075,.21,-.13,Math.PI/2);
 add(new T.CircleGeometry(.023,16),mats.glass,-.075,.21,-.024);
 box(.045,.174,.02,.035,.012,.055,mats.gold);
 const buckets=new Map();rigid.updateMatrixWorld(true);
 for(const mesh of rigid.children){const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(geo);mesh.geometry.dispose();}
 rigid.clear();for(const [mat,parts]of buckets){const mesh=new T.Mesh(mergeGeometries(parts),mat);rigid.add(mesh);parts.forEach(p=>p.dispose());}
 const magazine=new T.Group();magazine.name='training-rocket-reload';magazine.position.set(0,.09,.30);parent.add(magazine);
 const body=new T.Mesh(new T.CylinderGeometry(.049,.049,.29,16),mats.body);body.rotation.x=Math.PI/2;magazine.add(body);
 const tip=new T.Mesh(new T.ConeGeometry(.049,.12,16),mats.gold);tip.rotation.x=-Math.PI/2;tip.position.z=-.205;magazine.add(tip);
 // Bake only immutable mesh-local transforms. Magazine/weapon Groups remain
 // animated, and world matrices still follow their parents after cloning/dropping.
 for(const group of [rigid,magazine])group.traverse(mesh=>{
  if(mesh.isMesh&&mesh.children.length===0){mesh.updateMatrix();mesh.matrixAutoUpdate=false;}
 });
 return {grip:new T.Vector3(0,-.06,-.025),support:new T.Vector3(0,.012,-.27),muzzle:new T.Vector3(0,.09,-.585),magazine};
}
