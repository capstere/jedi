/** Fitted CC0 Quaternius hands with original cuffs and cloth sleeves.
 * Metres; presentation only. Two shared-material skins and two sleeve draws.
 * Sleeves join the glove's wrist frame, rather than stretching a cylinder/cuff.
 */
import * as T from 'three';
import {AUTHORED_HANDS} from './authored-hand-data.mjs';
const TAU=Math.PI*2,WRIST=-.101,SEGMENTS=24,RINGS=27;

export function createKitHand(parent,side,{material,own}){
 const source=AUTHORED_HANDS[side>0?'right':'left'],root=new T.Group();root.name=side>0?'kit-trigger-hand':'kit-support-hand';parent.add(root);
 const positions=[],normals=[],uvs=[],skinIndices=[],skinWeights=[],indices=[],copies=new Map();
 const uvFor=(x,y,dorsal)=>[(dorsal?0:.5)+T.MathUtils.clamp((x*side+.055)/.11,0,1)*.5,T.MathUtils.clamp((y+.102)/.25,0,1)];
 function vertex(p,n,uv,si=[0,0,0,0],sw=[1,0,0,0]){const id=positions.length/3;positions.push(...p);normals.push(...n);uvs.push(...uv);skinIndices.push(...si);skinWeights.push(...sw);return id;}
 function copy(i,dorsal){const key=i+':'+dorsal;if(copies.has(key))return copies.get(key);const p=Array.from(source.positions.subarray(i*3,i*3+3)),n=Array.from(source.normals.subarray(i*3,i*3+3));const id=vertex(p,n,uvFor(p[0],p[1],dorsal),source.skinIndices.subarray(i*4,i*4+4),source.skinWeights.subarray(i*4,i*4+4));copies.set(key,id);return id;}
 // Split the atlas at the side seam, retaining authored normals across UV islands.
 for(let i=0;i<source.indices.length;i+=3){const triangle=Array.from(source.indices.subarray(i,i+3)),dorsal=triangle.reduce((s,j)=>s+source.normals[j*3+2],0)>0;indices.push(...triangle.map(j=>copy(j,dorsal)));}
 const rings=[[-.101,.028,.0215],[-.099,.029,.0225],[-.094,.029,.0225],[-.080,.0278,.021],[-.076,.027,.0195]],ringIds=[];
 function outward(a,b,c){const va=new T.Vector3().fromArray(positions,a*3),vb=new T.Vector3().fromArray(positions,b*3),vc=new T.Vector3().fromArray(positions,c*3),normal=new T.Vector3().crossVectors(vb.clone().sub(va),vc.clone().sub(va));const mid=va.clone().add(vb).add(vc).divideScalar(3);if(normal.x*mid.x+normal.z*mid.z<0)indices.push(a,c,b);else indices.push(a,b,c);}
 for(const [y,rx,rz]of rings){const row=[];for(let j=0;j<=SEGMENTS;j++){const a=j/SEGMENTS*TAU,x=Math.cos(a)*rx,z=Math.sin(a)*rz,n=new T.Vector3(Math.cos(a)/rx,0,Math.sin(a)/rz).normalize();row.push(vertex([x,y,z],n.toArray(),uvFor(x,y,Math.sin(a)>=0)));}ringIds.push(row);}
 for(let r=0;r<ringIds.length-1;r++)for(let j=0;j<SEGMENTS;j++){const a=ringIds[r][j],b=ringIds[r+1][j],c=ringIds[r][j+1],d=ringIds[r+1][j+1];outward(a,b,c);outward(c,b,d);}
 // Bridge the authored oblique wrist cut into the fixed-size cuff. It is one
 // continuous surface, not a floating thumb/palm or a cuff placed over a gap.
 const boundary=source.metadata.wristBoundary.map(i=>({i,p:Array.from(source.positions.subarray(i*3,i*3+3))}));
 let area=0;for(let j=0;j<boundary.length;j++){const p=boundary[j].p,q=boundary[(j+1)%boundary.length].p;area+=p[0]*q[2]-q[0]*p[2];}if(area<0)boundary.reverse();
 let first=0;for(let j=1;j<boundary.length;j++)if(boundary[j].p[0]>boundary[first].p[0])first=j;
 boundary.push(...boundary.splice(0,first));boundary.forEach((entry,j)=>entry.angle=j/boundary.length*TAU);

 const bridge=boundary.map(({p,angle})=>{const x=Math.cos(angle)*.026,z=Math.sin(angle)*.019,point=[(p[0]+x)/2,(p[1]-.076)/2,(p[2]+z)/2];return vertex(point,new T.Vector3(Math.cos(angle),0,Math.sin(angle)).toArray(),uvFor(point[0],point[1],point[2]>=0));});
 const edge=boundary.map(({i,p})=>copy(i,p[2]>=0));
 for(let j=0;j<edge.length;j++){const next=(j+1)%edge.length;outward(bridge[j],edge[j],bridge[next]);outward(bridge[next],edge[j],edge[next]);}
 // Zipper two loops with different vertex counts without leaving holes.
 const outer=ringIds.at(-1);let i=0,j=0;
 while(i<SEGMENTS||j<boundary.length){const ai=(i+1)/SEGMENTS*TAU,aj=j+1<boundary.length?boundary[j+1].angle:TAU+boundary[0].angle;
  const a=outer[i%SEGMENTS],b=bridge[j%bridge.length];
  if(i<SEGMENTS&&(j>=boundary.length||ai<=aj)){outward(a,b,outer[(i+1)%SEGMENTS]);i++;}else{outward(a,b,bridge[(j+1)%bridge.length]);j++;}
 }
 const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));geometry.setIndex(indices);geometry.userData.sharedWeapon=true;
 const bones=source.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;bone.position.fromArray(b.position);bone.quaternion.fromArray(b.quaternion);bone.userData={rest:bone.quaternion.clone(),flexAxis:new T.Vector3(...b.flexAxis),bend:new T.Quaternion(),curl:0};return bone;});
 source.bones.forEach((b,i)=>{if(b.parent>=0)bones[b.parent].add(bones[i]);});
 const skin=new T.SkinnedMesh(geometry,material);skin.name='kit-skinned-glove';skin.frustumCulled=false;skin.add(bones[0]);skin.bind(own(new T.Skeleton(bones)));root.add(skin);
 const fingers=Array.from({length:5},(_,f)=>bones.slice(1+f*3,4+f*3));
 root.userData={fingers,skin,palm:bones[0],side,cuffEnd:WRIST,cuffLength:.025,authoredAnatomy:true,sourceLicense:'CC0-1.0'};return root;
}

export function poseKitFingers(hand,grip,trigger=false){
 const rifle=hand.userData.weapon==='cr4';
 hand.userData.fingers.forEach((bs,f)=>{
  // Authored thumb opposition and metacarpal splay stay in the bind pose.
  // Different finger lengths need staggered curls, rather than one mitten pose.
  const angles=f===4?(trigger?[-.62,.12,.08]:rifle?[-.40,.22,.14]:[-.62,.12,.08]):trigger&&f===0?[.17,.40,.22]:[.48+f*.055,(rifle?.95:1.06)+f*.035,.62+f*.035];
  bs.forEach((bone,k)=>{const d=bone.userData;d.curl=-angles[k]*grip;d.bend.setFromAxisAngle(d.flexAxis,d.curl);bone.quaternion.copy(d.rest).multiply(d.bend);});
 });
}

export function createKitSleeve(parent,side,{material,own}){
 const geometry=own(new T.BufferGeometry()),positions=new Float32Array(RINGS*(SEGMENTS+1)*3),uv=[],indices=[];
 for(let r=0;r<RINGS;r++)for(let j=0;j<=SEGMENTS;j++){
  const t=r/(RINGS-1);uv.push(j/SEGMENTS*3,t*6);
  if(r<RINGS-1&&j<SEGMENTS){const i=r*(SEGMENTS+1)+j,b=i+SEGMENTS+1;indices.push(i,i+1,b,i+1,b+1,b);}
 }
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(positions.length),3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.userData.sharedWeapon=true;
 const sleeve=new T.Mesh(geometry,material);sleeve.name='kit-forearm-'+side;sleeve.frustumCulled=false;sleeve.castShadow=false;sleeve.receiveShadow=true;parent.add(sleeve);
 sleeve.userData={side,last:new Float64Array(19).fill(NaN),rings:RINGS,segments:SEGMENTS,wrist:WRIST,
  w:new T.Vector3(),e:new T.Vector3(),a:new T.Vector3(),dir:new T.Vector3(),pole:new T.Vector3(),x:new T.Vector3(),z:new T.Vector3(),tangent:new T.Vector3(),previousTangent:new T.Vector3(),transport:new T.Quaternion(),center:new T.Vector3(),handX:new T.Vector3(),handY:new T.Vector3(),temp:new T.Vector3(),centers:new Float64Array(RINGS*3)};
 return sleeve;
}

export function fitKitSleeve(sleeve,hand,anchor){
 hand.updateMatrix();const d=sleeve.userData,m=hand.matrix.elements,last=d.last;
 let dirty=last[16]!==anchor.x||last[17]!==anchor.y||last[18]!==anchor.z;
 for(let i=0;i<16;i++)if(last[i]!==m[i])dirty=true;if(!dirty)return false;
 last.set(m);last[16]=anchor.x;last[17]=anchor.y;last[18]=anchor.z;
 const {w,e,a,dir,pole,x,z,tangent,center,handX,handY,temp,previousTangent,transport}=d;
 w.set(0,WRIST,0).applyMatrix4(hand.matrix);a.copy(anchor);dir.subVectors(w,a);const distance=dir.length();dir.normalize();
 // Two-segment elbow solution: upper and forearm have distinct volumes and bend.
 const upper=Math.max(.33,distance*.515),fore=Math.max(.32,distance*.50),along=(upper*upper-fore*fore+distance*distance)/(2*distance),height=Math.sqrt(Math.max(.0001,upper*upper-along*along));
 pole.set(d.side*.65,-1,.10).addScaledVector(dir,-temp.set(d.side*.65,-1,.10).dot(dir)).normalize();e.copy(a).addScaledVector(dir,along).addScaledVector(pole,height);
 handX.set(m[0],m[1],m[2]).normalize();handY.set(-m[4],-m[5],-m[6]).normalize();
 // Hermite halves share the elbow tangent; first tangent exactly matches cuff.
 for(let r=0;r<RINGS;r++){
  const t=r/(RINGS-1),first=t<=.53,u=first?t/.53:(t-.53)/.47,u2=u*u,u3=u2*u;
  const p0=first?w:e,p1=first?e:a,h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
  center.copy(p0).multiplyScalar(h00).addScaledVector(p1,h01);
  if(first){center.addScaledVector(handY,h10*.21);temp.subVectors(a,w).multiplyScalar(.48);center.addScaledVector(temp,h11);}
  else{temp.subVectors(a,w).multiplyScalar(.48);center.addScaledVector(temp,h10);temp.subVectors(a,e);center.addScaledVector(temp,h11);}
  d.centers[r*3]=center.x;d.centers[r*3+1]=center.y;d.centers[r*3+2]=center.z;
 }
 const positions=sleeve.geometry.attributes.position.array;
 for(let r=0;r<RINGS;r++){
  const t=r/(RINGS-1),lo=Math.max(0,r-1)*3,hi=Math.min(RINGS-1,r+1)*3;
  center.fromArray(d.centers,r*3);if(r===0)tangent.copy(handY);else tangent.set(d.centers[hi]-d.centers[lo],d.centers[hi+1]-d.centers[lo+1],d.centers[hi+2]-d.centers[lo+2]).normalize();
  if(r===0)x.copy(handX);else{transport.setFromUnitVectors(previousTangent,tangent);x.applyQuaternion(transport);x.addScaledVector(tangent,-x.dot(tangent)).normalize();}
  previousTangent.copy(tangent);z.crossVectors(x,tangent).normalize();
  // Hand -Y points toward the elbow; X cross -Y reverses local Z.
  z.negate();
  const width=.028+.023*Math.sin(Math.min(1,t/.58)*Math.PI/2)+.006*t,heightRadius=.0215+.016*Math.sin(Math.min(1,t/.60)*Math.PI/2)+.006*t;
  for(let j=0;j<=SEGMENTS;j++){
   const angle=j/SEGMENTS*TAU,c=Math.cos(angle),s=Math.sin(angle);
   // Asymmetric compressed folds at wrist and elbow, with smooth broad fabric elsewhere.
   const wristFold=Math.exp(-Math.pow((t-.10)/.09,2))*Math.sin(t*60+Math.sin(angle)*.6),elbowFold=Math.exp(-Math.pow((t-.53)/.16,2))*Math.sin(t*42+Math.sin(angle)*1.1);
   const fold=(wristFold*.0026+elbowFold*.0035)*Math.min(1,t*35),rx=width+fold,rz=heightRadius+fold*.7;
   const i=(r*(SEGMENTS+1)+j)*3;positions[i]=center.x+x.x*c*rx+z.x*s*rz;positions[i+1]=center.y+x.y*c*rx+z.y*s*rz;positions[i+2]=center.z+x.z*c*rx+z.z*s*rz;
  }
 }
 sleeve.geometry.attributes.position.needsUpdate=true;sleeve.geometry.computeVertexNormals();
 // Smooth the duplicated UV seam so cloth does not get a hard longitudinal ridge.
 const normals=sleeve.geometry.attributes.normal.array;
 for(let r=0;r<RINGS;r++){const i=r*(SEGMENTS+1)*3,k=i+SEGMENTS*3;temp.set(normals[i]+normals[k],normals[i+1]+normals[k+1],normals[i+2]+normals[k+2]).normalize();temp.toArray(normals,i);temp.toArray(normals,k);}
 sleeve.geometry.attributes.normal.needsUpdate=true;return true;
}
