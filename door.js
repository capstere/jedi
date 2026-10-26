/* Hissrum 12 V4: non-destructive isolation of the original right lift leaf.
 * Original V2 mesh buffers are retained. Connected components separate the leaf
 * from its frame; no replacement panel or duplicate closed leaf is introduced.
 * East/right hinge is supported by reconstructed visible hinge fittings.
 * Inward swing is a planning assumption; direction is configurable.
 */
(function(root){'use strict';
const HINGE=[2.44,0,-3.755],WIDTH=1.394,HEIGHT=2.82;
const clamp=v=>Math.max(0,Math.min(90,Number(v)||0));
function splitPrimitive(name,positions,indices){
 const eligible=['north__liftblue','north__aluminium','north__glass','north__steel','north__white','north__sign_freight','north__sign_lift_instruction','north__sign_stop'];
 if(!eligible.includes(name))return {fixed:indices,moving:new indices.constructor(0)};
 const vertexTriangles=new Map(),keys=[];
 for(let i=0;i<positions.length;i+=3)keys.push([positions[i],positions[i+1],positions[i+2]].map(v=>Math.round(v*1e5)).join(':'));
 for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const key=keys[indices[i+k]];if(!vertexTriangles.has(key))vertexTriangles.set(key,[]);vertexTriangles.get(key).push(i);}
 const seen=new Set(),fixed=[],moving=[];
 for(let i=0;i<indices.length;i+=3){if(seen.has(i))continue;const queue=[i],component=[],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];seen.add(i);
  while(queue.length){const t=queue.pop();component.push(t);for(let k=0;k<3;k++){const v=indices[t+k];for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],positions[v*3+a]);hi[a]=Math.max(hi[a],positions[v*3+a]);}for(const n of vertexTriangles.get(keys[v]))if(!seen.has(n)){seen.add(n);queue.push(n);}}}
  // Entire connected components must fit the right leaf. This excludes frame,
  // threshold, left leaf, wall-mounted controls and the central closer plate.
  const isLeaf=lo[0]>=1.045&&hi[0]<=2.465&&lo[1]>=-.001&&hi[1]<=2.821&&lo[2]>=-3.854&&hi[2]<=-3.59;
  const out=isLeaf?moving:fixed;for(const t of component)out.push(indices[t],indices[t+1],indices[t+2]);
 }
 return {fixed:new indices.constructor(fixed),moving:new indices.constructor(moving)};
}
function matrix(degrees,direction){const a=-clamp(degrees)*(direction===-1?-1:1)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[x,,z]=HINGE;return {model:new Float32Array([c,0,s,0,0,1,0,0,-s,0,c,0,x-c*x+s*z,0,z-s*x-c*z,1]),normal:new Float32Array([c,0,s,0,1,0,-s,0,c])};}
function createLiftDoor({invalidate=()=>{}}={}){
 let degrees=0,target=0,direction=1,animation=null,showSweep=true;
 function setAngle(value,animate=true){target=clamp(value);animation=animate?{from:degrees,start:performance.now(),duration:380}:null;if(!animate)degrees=target;invalidate();}
 function setDirection(value){direction=value===-1?-1:1;invalidate();}
 function tick(time){if(!animation)return false;const t=Math.max(0,Math.min(1,(time-animation.start)/animation.duration)),ease=t*t*(3-2*t);degrees=animation.from+(target-animation.from)*ease;if(t>=1)animation=null;return true;}
 function sweepPolygon(angle=target){const points=[[HINGE[0],HINGE[2]]],steps=Math.max(1,Math.ceil(clamp(angle)/5));for(let i=0;i<=steps;i++){const a=clamp(angle)*i/steps*Math.PI/180;points.push([HINGE[0]-WIDTH*Math.cos(a),HINGE[2]+direction*WIDTH*Math.sin(a)]);}return points;}
 function snapshot(){return {angle:target,direction,showSweep};}
 function restore(value={}){setDirection(value.direction);showSweep=value.showSweep!==false;setAngle(value.angle??value.degrees??0,false);}
 function exportRoomGLB(binary){
  // Bake only moving vertices into a new copy, retaining all embedded textures.
  // Export is a static pose, while original and JSON retain editable animation.
  const out=binary.slice(0),view=new DataView(out),jsonLen=view.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(out,20,jsonLen))),bo=28+jsonLen,pose=matrix(degrees,direction);
  const accessor=index=>{const a=j.accessors[index],bv=j.bufferViews[a.bufferView],C={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];return new C(out,bo+(bv.byteOffset||0)+(a.byteOffset||0),a.count*n);};
  for(const mesh of j.meshes)for(const primitive of mesh.primitives){const p=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices),split=splitPrimitive(mesh.name,p,indices);if(!split.moving.length)continue;const n=accessor(primitive.attributes.NORMAL),m=pose.model,nm=pose.normal;
   for(const v of new Set(split.moving)){const i=v*3,x=p[i],y=p[i+1],z=p[i+2],nx=n[i],ny=n[i+1],nz=n[i+2];p[i]=m[0]*x+m[8]*z+m[12];p[i+1]=y;p[i+2]=m[2]*x+m[10]*z+m[14];n[i]=nm[0]*nx+nm[6]*nz;n[i+1]=ny;n[i+2]=nm[2]*nx+nm[8]*nz;}
   const a=j.accessors[primitive.attributes.POSITION];a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++)a.min[i%3]=Math.min(a.min[i%3],p[i]),a.max[i%3]=Math.max(a.max[i%3],p[i]);
  }
  j.asset.extras={...(j.asset.extras||{}),liftDoor:{...snapshot(),angle:degrees,staticPose:true,hinge:HINGE,assumption:'Right/east reconstructed hinge; direction configurable. Illustrative only.'}};
  const text=new TextEncoder().encode(JSON.stringify(j)),padded=(text.length+3)&~3,bin=out.slice(bo),result=new ArrayBuffer(28+padded+bin.byteLength),dv=new DataView(result);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,result.byteLength,true);dv.setUint32(12,padded,true);dv.setUint32(16,0x4e4f534a,true);new Uint8Array(result,20,padded).fill(32);new Uint8Array(result,20,text.length).set(text);dv.setUint32(20+padded,bin.byteLength,true);dv.setUint32(24+padded,0x004e4942,true);new Uint8Array(result,28+padded).set(new Uint8Array(bin));return result;
 }
 return {setAngle,setDirection,tick,snapshot,restore,splitPrimitive,sweepPolygon,exportRoomGLB,get matrix(){return matrix(degrees,direction)},get degrees(){return degrees},get target(){return target},get direction(){return direction},get showSweep(){return showSweep},set showSweep(v){showSweep=!!v;invalidate();},hinge:HINGE,width:WIDTH,height:HEIGHT};
}
root.createLiftDoor=createLiftDoor;root.LiftDoorGeometry={splitPrimitive,matrix,hinge:HINGE,width:WIDTH,height:HEIGHT};if(typeof module==='object'&&module.exports)module.exports={createLiftDoor,splitPrimitive,matrix,hinge:HINGE,width:WIDTH,height:HEIGHT};
})(typeof globalThis!=='undefined'?globalThis:this);
