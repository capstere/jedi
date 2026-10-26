'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../source/planner-core.js');
require('../source/cartridge-mesh.js');
require('../source/object-library.js');
require('../source/studio-core.js');
const info=require('../source/model_manifest.json');
const obj=(type,id,patch={})=>({...C.byType[type],id,type,name:C.byType[type].name,x:0,y:C.FLOOR,z:0,rot:0,locked:false,...patch});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
const save=objects=>C.createLayout({objects});

test('All 26 catalog geometries fit their dimensions; bag has exactly ten source meshes',()=>{
 assert.equal(C.CATALOG.length,26);
 for(const item of C.CATALOG){
  const meshes=C.buildGeometry(item.type,item);assert.ok(meshes.length);
  for(const m of meshes){
   assert.equal(m.p.length,m.n.length);assert.equal(m.uv.length,m.p.length/3*2);
   for(let i=0;i<m.p.length;i+=3){
    assert.ok(m.p[i]>=-item.w/2-.012&&m.p[i]<=item.w/2+.012,item.type+' width');
    assert.ok(m.p[i+1]>=-.012&&m.p[i+1]<=item.h+.012,item.type+' height');
    assert.ok(m.p[i+2]>=-item.d/2-.012&&m.p[i+2]<=item.d/2+.012,item.type+' depth');
   }
   assert.ok(m.n.every(Number.isFinite));assert.ok(C.MATS[m.mat]);
  }
 }
 const bag=C.buildGeometry('sampleBag');assert.equal(bag.cartridgeCount,10);
 for(const part of globalThis.CartridgeMesh.parts)assert.equal(bag.find(g=>g.mat===part.mat).p.length,part.p.length*10);
 assert.ok(bag.some(g=>C.MATS[g.mat][3]<.3),'bag film remains distinct from solid cartridges');
});

test('V3 migration preserves every legacy object dimension and world position',()=>{
 const types=['pallet','palletBins','fridge','yellowBin','wheelBin','shelf','cart','material'];
 const objects=types.map((type,i)=>obj(type,String(i),{x:.137+i*.2,z:-1.247+i*.15,w:1.031,d:.732,h:1.126,rot:37}));
 const old={format:'hissrum12-v3-layout',version:3,model:C.MODEL,objects,measures:[{a:[0,.028,0],b:[1,.028,1]}],zones:[]};
 const migrated=C.validate(old,info);
 assert.equal(migrated.version,4);assert.equal(migrated.objects.length,8);
 for(let i=0;i<objects.length;i++)for(const k of ['type','id','x','z','w','d','h','rot'])assert.equal(migrated.objects[i][k],objects[i][k],k);
 assert.deepEqual(migrated.tapes,[]);assert.equal(C.validate(C.createLayout(migrated),info).objects.length,8);
});

test('Two independent small boxes above and one large below fit the reference cart',()=>{
 const cart=obj('creformCart','cart');
 const surfaces=C.surfaces(cart);assert.equal(surfaces.length,2);
 close(surfaces[0].y,C.FLOOR+.22);close(surfaces[1].y,C.FLOOR+.72);
 close(surfaces[1].w,.75);close(surfaces[1].d,.45);
 const one=C.attachToSurface(obj('plasticBoxSmall','a',{x:-.17}),cart,'shelf-1',[cart]);
 const two=C.attachToSurface(obj('plasticBoxSmall','b',{x:.17}),cart,'shelf-1',[cart,one.object]);
 const big=C.attachToSurface(obj('plasticBoxLarge','c'),cart,'shelf-0',[cart,one.object,two.object]);
 assert.ok(one.fit&&two.fit&&big.fit);assert.equal(two.warning,null);
 close(one.object.y,.726);close(big.object.y,.226);
 assert.equal(C.check([cart,one.object,two.object,big.object],info).filter(i=>i.kind==='object'||i.kind==='support').length,0);
 const bad=C.attachToSurface(obj('plasticBoxLarge','bad',{w:1}),cart,'shelf-1');
 assert.equal(bad.fit,false);assert.ok(bad.warning);
});

test('Nested attachments rotate/translate with cart and detach without losing contents',()=>{
 const cart=obj('creformCart','cart');
 const box=C.attachToSurface(obj('plasticBoxSmall','box',{x:-.17}),cart,'shelf-1').object;
 const bag=C.attachToSurface(obj('sampleBag','bag',{x:-.17}),box,'inside').object;
 const scene=[cart,box,bag],moved=C.moveHierarchy(scene,'cart',{x:1,z:2,rot:90});
 close(moved[1].x,1);close(moved[1].z,1.83);close(moved[2].z,1.83);
 close(moved[2].y,box.y+.007);assert.equal(moved[2].rot,90);
 assert.equal(scene[0].x,0,'input must not mutate');
 const detached=C.detachObject(moved,'box',true);
 assert.equal(detached[1].parentId,undefined);close(detached[1].y,C.FLOOR);close(detached[2].y,C.FLOOR+.007);
 assert.equal(detached[2].parentId,'box');
 const duplicated=C.duplicateHierarchy(scene,['cart'],.2);
 assert.equal(duplicated.objects.length,6);
 const newCart=duplicated.objects.find(o=>o.id===duplicated.ids[0]),newBox=duplicated.objects.find(o=>o.parentId===newCart.id),newBag=duplicated.objects.find(o=>o.parentId===newBox.id);
 assert.ok(newBag);close(newBag.x,bag.x+.2);
 assert.equal(C.validate(save(duplicated.objects),info).objects.length,6);
});

test('Shelf changes lift descendant stacks; same-height peers collide but parents do not',()=>{
 const shelf=obj('shelf','shelf'),a=C.attachToSurface(obj('plasticBoxSmall','a',{x:0}),shelf,'shelf-0').object;
 const b={...a,id:'b'},c=C.attachToSurface(obj('plasticBoxSmall','c'),shelf,'shelf-1').object;
 const collisions=C.check([shelf,a,b,c],info).filter(i=>i.kind==='object');
 assert.deepEqual(collisions.map(i=>i.ids),[['a','b']]);
 const taller=C.moveHierarchy([shelf,a,c],'shelf',{h:2});
 close(taller[1].y,C.FLOOR+.0925*2/1.8);close(taller[2].y,C.FLOOR+.6425*2/1.8);
});

test('Changing attachment kind removes incompatible anchor fields during a move',()=>{
 const wall=C.snapWall(obj('sign','sign',{x:3}), 'north',1.3,info).object;
 const shelf=obj('shelf','shelf');
 const attached=C.attachToSurface({...wall,rot:0},shelf,'shelf-1').object;
 const scene=C.moveHierarchy([shelf,wall],'sign',attached);
 assert.equal(scene[1].mount,undefined);assert.equal(scene[1].parentId,'shelf');
 const next=C.snapWall({...scene[1],x:3},'north',1.3,info).object;
 const mounted=C.moveHierarchy(scene,'sign',next);
 assert.equal(mounted[1].parentId,undefined);assert.equal(mounted[1].surfaceId,undefined);assert.equal(mounted[1].mount.side,'north');
 assert.equal(C.validate(save(mounted),info).objects.length,2);
 const west=C.snapWall(obj('gloveHolder','west',{z:-2.8}),'west',1.3,info).object;
 const east=C.snapWall(obj('gloveHolder','east',{z:-2.8}),'east',1.3,info).object;
 assert.equal(west.rot,270);assert.equal(east.rot,90);
});

test('Removing builder shelf levels remaps children without invalidating saved layout',()=>{
 const builder=obj('creformBuilder','builder',{params:{levels:3,pipeDiameter:.028,wheels:4,brakes:2}});
 const box=C.attachToSurface(obj('plasticBoxSmall','box'),builder,'shelf-2').object;
 const bag=C.attachToSurface(obj('sampleBag','bag'),box,'inside').object;
 const scene=C.moveHierarchy([builder,box,bag],'builder',{params:{...builder.params,levels:1}});
 assert.equal(scene[1].surfaceId,'shelf-0');close(scene[1].y,C.surfaces(scene[0])[0].y);close(scene[2].y,scene[1].y+.007);
 assert.equal(C.validate(save(scene),info).objects.length,3);
});

test('Import rejects cycles, dangling surfaces, nonfinite data and malformed variants',()=>{
 const cart=obj('creformCart','cart'),box=C.attachToSurface(obj('plasticBoxSmall','box'),cart,'shelf-1').object;
 assert.throws(()=>C.validate(save([{...cart,parentId:'box',surfaceId:'inside'},box]),info),/Cirkulär/);
 assert.throws(()=>C.validate(save([{...box,parentId:'missing'}]),info),/saknas/);
 assert.throws(()=>C.validate(save([cart,{...box,surfaceId:'imaginary'}]),info),/Stödytan/);
 assert.throws(()=>C.validate(save([{...cart,x:Infinity}]),info));
 assert.throws(()=>C.validate({...save([]),variants:Array(3).fill({id:'A',data:save([])})},info));
 const variant=save([cart,box]);variant.variants=[{id:'B',data:save([])}];
 const pair=C.validate({...save([]),variants:[{id:'A',data:variant}]},info);
 assert.equal(pair.variants[0].id,'A');assert.equal(pair.variants[0].data.objects.length,2);assert.deepEqual(pair.variants[0].data.variants,[]);
 assert.throws(()=>C.validate({...save([]),door:{angle:91,direction:1}},info));
 assert.throws(()=>C.validate({...save([]),door:{angle:0,direction:0}},info));
 assert.throws(()=>C.validate(save([{...cart,params:{pipeDiameter:100}}]),info));
});

test('Wall placement sets base height, rejects openings and avoids false floor-door issues',()=>{
 const item=obj('gloveHolder','gloves',{x:3,z:-1});
 const wall=C.snapWall(item,'north',1.4,info);assert.ok(wall.fit);close(wall.object.y,1.4);assert.equal(wall.object.mount.side,'north');
 const blocked=C.snapWall({...item,x:1.4},'north',1.4,info);assert.equal(blocked.fit,false);assert.match(blocked.warning,/öppningen/);
 const cabinet=C.snapWall({...item,x:0},'south',1.4,info);assert.equal(cabinet.fit,false);
 const issues=C.check([{...wall.object,x:1,z:-3.5}],info);
 assert.equal(issues.some(i=>i.kind==='door'),false);
 assert.equal(C.validate(save([wall.object]),info).objects[0].mount.type,'wall');
});

test('Tape has separate budget, bounded points, full roundtrip, and no collisions',()=>{
 const tapes=Array.from({length:60},(_,i)=>({id:'t'+i,name:'Tejp',style:C.TAPE_STYLES[i%8],width:.05,dashed:i%2===0,points:[[0,0],[1,0],[1,1]]}));
 const layout=C.validate({...save([]),tapes},info);
 assert.equal(layout.tapes.length,60);assert.equal(C.check([],info,1,layout).length,0);close(C.tapeLength(layout.tapes[0]),2);
 const rectangle={...tapes[0],points:[[0,0],[2,0],[2,1],[0,1],[0,0]]};
 close(C.layoutStats({...save([]),tapes:[rectangle]},info).markedArea,2);
 assert.deepEqual(C.validate(C.createLayout(layout),info).tapes,layout.tapes);
 assert.throws(()=>C.validate({...save([]),tapes:[{...tapes[0],points:[[0,0],[NaN,1]]}]},info));
 assert.throws(()=>C.validate({...save([]),tapes:Array.from({length:257},(_,i)=>({...tapes[0],id:'x'+i}))},info),/tejpsegment/);
});

test('Keep-clear clearance is checked separately and shelf contents are not floor hazards',()=>{
 const cart=obj('creformCart','cart'),box=C.attachToSurface(obj('plasticBoxSmall','box'),cart,'shelf-1').object;
 const extras={keepClear:[{id:'path',name:'Passage',x:1,z:0,w:.5,d:.5,rot:0,clearance:.4}]};
 assert.deepEqual(C.check([cart,box],info,1,extras).filter(i=>i.kind==='keepClear').map(i=>i.ids),[['cart']]);
 const result=C.validate({...save([cart,box]),keepClear:extras.keepClear},info);
 assert.equal(result.keepClear[0].clearance,.4);
});

test('Exact measured door hinge opens inward; sweep and direction match collision geometry',()=>{
 const closed=C.doorLeaf(info,{angle:0,direction:1}),opened=C.doorLeaf(info,{angle:90,direction:1});
 close(closed.x,1.755);close(closed.z,-3.82);close(opened.x,2.375);close(opened.z,-3.07);
 const obstacle=obj('pallet','obstacle',{x:2.25,z:-2.9,w:.3,d:.3,h:.5});
 assert.equal(C.intersectsDoorSweep(obstacle,info,{angle:90,direction:1}),true);
 assert.equal(C.intersectsDoorSweep(obstacle,info,{angle:90,direction:-1}),false);
 assert.equal(C.intersectsDoorSweep(obstacle,info,{angle:0,direction:1}),false);
 assert.ok(C.check([obstacle],info,1,{door:{angle:90,direction:1}}).some(i=>i.kind==='doorSweep'));
});

test('Elevated object picking and support-ray hits agree with model transform',()=>{
 const box=obj('plasticBoxSmall','box',{x:1,z:1,y:.8,rot:90});
 close(C.matrix(box).model[13],Math.fround(.8));
 close(C.rayHit({origin:[1,2,1],dir:[0,-1,0]},box),1.02);
 assert.equal(C.rayHit({origin:[1,.2,1],dir:[0,0,1]},box),null);
 const cart=obj('creformCart','cart');
 const hit=C.nearestSupport({origin:[0,2,0],dir:[0,-1,0]},[cart]);
 assert.equal(hit.surface.id,'shelf-1');close(hit.y,.726);
 assert.equal(C.nearestSupport({origin:[0,2,0],dir:[0,-1,0]},[cart],'cart'),null);
});
