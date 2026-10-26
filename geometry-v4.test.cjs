'use strict';
// Concentrated geometry contract test; no browser, network or development server.
const assert=require('node:assert/strict');
const C=require('../source/planner-core.js');
require('../source/cartridge-mesh.js');
require('../source/object-library.js');
const expected=['largeWheelBin','palletTruck','cageCart','dryIceDrum','nitrogenTank',
  'extinguisher','extinguisherBracket','creformCart','creformBuilder','plasticBoxSmall',
  'plasticBoxLarge','phoneArm','gloveHolder','sampleBag','carton','knife','mallet','sign'];
for(const type of expected)assert(C.byType[type],`Missing equipment: ${type}`);
assert.equal(C.CATALOG.length,26,'All eight V3 and eighteen V4 catalogue entries remain.');
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function bounds(geometry){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const part of geometry){
    assert(part.p instanceof Float32Array);
    assert.equal(part.p.length%9,0);
    assert.equal(part.n.length,part.p.length);
    assert.equal(part.uv.length,part.p.length/3*2);
    assert(C.MATS[part.mat],`Missing material: ${part.mat}`);
    assert.equal(C.MATS[part.mat].length,4);
    for(let i=0;i<part.p.length;i++){
      assert(Number.isFinite(part.p[i])&&Number.isFinite(part.n[i]),'Finite vertices and normals');
      min[i%3]=Math.min(min[i%3],part.p[i]);max[i%3]=Math.max(max[i%3],part.p[i]);
    }
    for(let i=0;i<part.n.length;i+=3)assert(Math.abs(Math.hypot(...part.n.slice(i,i+3))-1)<.0001,'Unit normal');
    for(const uv of part.uv)assert(Number.isFinite(uv),'Finite UV');
  }
  assert(min.every(Number.isFinite),'Nonempty geometry');
  return {min,max};
}
for(const def of C.CATALOG){
  const {min,max}=bounds(C.buildGeometry(def.type,def));
  // Labels/handles are millimetre details; V3's original footprints are retained.
  const tolerance=C.V4_OBJECT_TYPES.includes(def.type)?.005:.012;
  assert(min[0]>=-def.w/2-tolerance&&max[0]<=def.w/2+tolerance,`${def.type}: width bounds`);
  assert(min[1]>=-tolerance&&max[1]<=def.h+tolerance,`${def.type}: height bounds`);
  assert(min[2]>=-def.d/2-tolerance&&max[2]<=def.d/2+tolerance,`${def.type}: depth bounds`);
}
const cart=C.byType.creformCart,spec=C.creformSpec(cart);
close(spec.innerW,.750);close(spec.innerD,.450);close(cart.h,.950);
assert.deepEqual(spec.heights,[.220,.720]);close(spec.diameter,.028);
assert.equal(spec.wheels,4);assert.equal(spec.brakes,2);
const cartGeometry=C.buildGeometry('creformCart',cart);
assert(cartGeometry.every(p=>!/^plastic|^bag|^cartridge/.test(p.mat)),'Reference cart has no permanently integrated boxes or contents.');
const small=C.byType.plasticBoxSmall,large=C.byType.plasticBoxLarge;
assert(small.w*2<spec.innerW&&small.d<spec.innerD,'Two small boxes fit side by side.');
assert(large.w<spec.innerW&&large.d<spec.innerD,'Large box fits lower shelf.');
assert(spec.heights[0]+large.h<spec.heights[1]-.028,'Lower box clears upper support tubes.');
assert(spec.heights[1]+small.h<cart.h,'Upper boxes fit under upper perimeter.');
const bag=C.buildGeometry('sampleBag',C.byType.sampleBag);
assert.equal(bag.cartridgeCount,10);
for(const source of globalThis.CartridgeMesh.parts){
  const batch=bag.find(p=>p.mat===source.mat);
  assert(batch,`Cartridge material ${source.mat} remains present`);
  assert.equal(batch.p.length,source.p.length*10,'Exactly ten copies of each cartridge mesh component.');
}
assert.equal(globalThis.CartridgeMesh.source.publicDistributionApproved,false);
assert.equal(globalThis.CartridgeMesh.triangles,491,'Optimised native far LOD retained.');
const resized={...C.byType.creformBuilder,w:1.05,d:.68,h:1.6,params:{levels:4,pipeDiameter:.028,wheels:0,brakes:0}};
const resizedSpec=C.creformSpec(resized);assert.equal(resizedSpec.levels,4);assert.equal(resizedSpec.wheels,0);
close(resizedSpec.diameter,.028);
bounds(C.buildGeometry('creformBuilder',resized));
assert.notEqual(C.geometryKey(resized),C.geometryKey(C.byType.creformBuilder));
assert.equal(C.geometryKey({...resized,x:4,z:2,rot:90}),C.geometryKey(resized),'Transforms reuse GPU geometry.');
assert.deepEqual(C.geometryDimensions(resized),{w:1.05,d:.68,h:1.6});
for(const params of [{direction:-65,reach:.8},{direction:65,reach:.08}]){
  const object={...C.byType.phoneArm,params},b=bounds(C.buildGeometry('phoneArm',object));
  assert(b.min[0]>=-object.w/2-.005&&b.max[0]<=object.w/2+.005,'Directed phone arm stays within its declared footprint.');
}
for(const [type,params] of [['carton',{open:true}],['nitrogenTank',{stand:false}],['gloveHolder',{color:'purple'}],['sign',{text:'MATERIAL / REKVISITIONER'}]]){
  const item={...C.byType[type],params};bounds(C.buildGeometry(type,item));
  assert.notEqual(C.geometryKey(item),C.geometryKey(C.byType[type]),`${type}: editable parameters have distinct resources`);
}
console.log('PASS geometry-v4: 26 catalogue models, finite buffers/extents, reference cart, exact 10 cartridges, parameters and transform cache contract.');
