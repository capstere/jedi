'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const assets=require('../source/npc-assets.js');
const {createNpcRenderer}=require('../source/npc-renderer.js');
const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/people/provenance.json'),'utf8'));
assert.equal(assets.license,'CC0-1.0');
assert.equal(assets.variants.length,4);
assert.equal(new Set(assets.variants.map(v=>v.id)).size,4);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/people/characters.compact.json'),'utf8')),assets);
function decode(text,Type){const b=Buffer.from(text,'base64');return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
// The pose sampler does not use WebGL. A stub permits testing its matrix maths
// separately; the offline browser smoke exercises the actual WebGL program.
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true},{get:(o,k)=>k in o?o[k]:()=>({})});
const renderer=createNpcRenderer({gl,assets});
for(const v of assets.variants){
 assert.equal(v.nodes.length,7);
 assert.equal(v.inverseBind.length,112);
 const origin=provenance.files.find(p=>p.id===v.id);
 assert.match(origin.sha256,/^[a-f0-9]{64}$/);
 for(const name of ['idle','walk','emote-yes','emote-no','interact-right','holding-both','pick-up']){
  const c=v.clips[name];assert(c&&c.duration>0);
  for(const ch of c.channels){assert(ch.times.every((t,i)=>Number.isFinite(t)&&(!i||t>=ch.times[i-1])));assert(ch.values.every(Number.isFinite));assert.equal(ch.values.length,ch.times.length*(ch.path==='rotation'?4:3));}
 }
 for(const lod of v.lods){
  const positions=decode(lod.positions,Float32Array),indices=decode(lod.indices,Uint16Array),joints=decode(lod.joints,Uint8Array);
  assert.equal(positions.length,lod.vertices*3);assert.equal(indices.length,lod.triangles*3);
  assert(positions.every(Number.isFinite));assert(indices.every(i=>i<lod.vertices));assert(joints.every(i=>i<7));
  assert.equal(Buffer.from(lod.colors,'base64').length,lod.vertices*3);
 }
 assert(v.lods[1].triangles<v.lods[0].triangles,'LOD must reduce actual triangles');
 const idle=renderer.samplePose(v.id,'idle',0),walkA=renderer.samplePose(v.id,'walk',0),walkB=renderer.samplePose(v.id,'walk',.16667);
 assert([...idle,...walkA,...walkB].every(Number.isFinite));
 assert(Math.max(...walkA.map((x,i)=>Math.abs(x-walkB[i])))>.1,'Original walk must move the rig');
 for(const state of ['idle','walk','turn','look','gesture','phone','dance']){
  const pose=renderer.samplePose(v.id,state,.31);assert.equal(pose.length,112);
  for(let joint=0;joint<7;joint++){const m=pose.subarray(joint*16,joint*16+16);for(let col=0;col<3;col++)assert(Math.abs(Math.hypot(m[col*4],m[col*4+1],m[col*4+2])-1)<.002,'Skin transform must preserve scale');}
 }
}
renderer.dispose();
console.log('PASS: 4 CC0 models; full/LOD buffers; 7 retained source clips; articulated idle/walk and finite scale-preserving skin poses.');
