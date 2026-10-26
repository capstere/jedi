/* Focused cabin, portal, original mesh and visual travel checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../source/elevator.js'),D=require('../source/door.js');
const geometry=E.buildGeometry();let triangles=0;
for(const p of geometry){assert.equal(p.p.length,p.n.length);assert.equal(p.uv.length,p.p.length/3*2);assert(p.p.every(Number.isFinite));assert(E.colors[p.mat]);triangles+=p.p.length/9;}
assert(triangles<6000,'Cabin must remain compact');assert(geometry.some(p=>p.layer==='floor'));assert(geometry.some(p=>p.layer==='ceiling'));
assert.equal(E.isNavigable(0,0,.22,0),true);assert.equal(E.isNavigable(1.65,-4.45,.22,0),true,'Cabin remains walkable with closed door');
assert.equal(E.isNavigable(1.65,-3.8,.22,0),false);assert.equal(E.isNavigable(1.65,-3.8,.22,90),true);assert.equal(E.isNavigable(.5,-3.8,.22,90),false,'Left leaf stays closed');
assert.equal(E.isNavigable(3,-5,.22,90),false);assert.equal(E.isNavigable(1,-7,.22,90),false);assert.equal(E.isNavigable(NaN,-4),false);
for(const dir of[-1,1]){const a=60*Math.PI/180,x=2.44-.7*Math.cos(a),z=-3.755+dir*.7*Math.sin(a);assert(E.doorwayBlocked(x,z,.22,60,dir),'Door leaf capsule must rotate in either direction');}
const door=D.createLiftDoor();door.setAngle(90,false);const e=E.createFreightElevator({door});assert.equal(e.canWalk(1.65,-4,.18,[1.65,0,-3.5]),true);assert.equal(e.canWalk(.5,-4,.18,[.5,0,-3.5]),false,'Swept movement cannot jump through left leaf');
assert.equal(e.setFloor(4),false);assert.equal(e.setFloor(5),true);door.setAngle(0,false);assert(e.tick(100));assert(e.tick(1700));assert.equal(e.floor,3);e.tick(3400);assert.equal(e.floor,5);assert.equal(e.travelling,false);assert.equal(door.target,90);assert.equal(e.setFloor(5),false);
e.setLights(false);assert.equal(e.snapshot().lights,false);e.restore({floor:3,lights:true});assert.equal(e.floor,3);assert.equal(e.lights,true);
// Original north__paint has five boxes around an existing aperture, not a solid
// backing wall. Ray intersections through the right door area must hit no paint.
const raw=fs.readFileSync(path.join(__dirname,'../model/Hissrum12_REKONSTRUERAT_V2.glb')),binary=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),dv=new DataView(binary),len=dv.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(binary,20,len))),offset=len+28;
function acc(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],T={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];return new T(binary,offset+(v.byteOffset||0)+(a.byteOffset||0),a.count*{VEC3:3,SCALAR:1}[a.type]);}
let paintTriangles=0;
for(const m of j.meshes)if(m.name==='north__paint')for(const p of m.primitives){const pos=acc(p.attributes.POSITION),ind=acc(p.indices);paintTriangles+=ind.length/3;
 for(let i=0;i<ind.length;i+=3){const vs=Array.from(ind.slice(i,i+3),v=>Array.from(pos.slice(v*3,v*3+3)));const lo=[0,1,2].map(k=>Math.min(...vs.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...vs.map(v=>v[k])));assert(!(lo[0]<2.40&&hi[0]>1.09&&lo[1]<2.70&&hi[1]>.10),'Paint triangle must not cover right lift aperture');}}
assert.equal(paintTriangles,60);assert.equal(D.hinge[0],E.portal.east);e.dispose();
console.log(JSON.stringify({cabinTriangles:triangles,materialBatches:geometry.length,portalBothDirections:true,visualTravel:true,originalWallOpening:true,originalDoorReused:true}));
