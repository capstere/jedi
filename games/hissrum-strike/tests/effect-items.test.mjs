import test from 'node:test';
import assert from 'node:assert/strict';
import {compactEffectItems,clearEffectItems} from '../src/effect-items.mjs';

function fixture(specs){
 const released=[],visited=[];
 const batch={release:mesh=>released.push(mesh.id)};
 const items=specs.map((s,id)=>({kind:'dust',until:10,mesh:{id},batch,...s}));
 const context={visited};
 function step(item,dt,camera){assert.equal(this,context);visited.push(item.mesh.id);return item.keep!==false;}
 return {items,released,visited,context,step};
}

test('empty effect list neither visits nor releases and retains array identity',()=>{
 const f=fixture([]),original=f.items;
 assert.equal(compactEffectItems(f.items,0,false,f.step,f.context),0);
 assert.equal(clearEffectItems(f.items),0);
 assert.equal(f.items,original);assert.deepEqual(f.visited,[]);assert.deepEqual(f.released,[]);
});

test('compaction keeps insertion order, item identity and original transparent slot order',()=>{
 const f=fixture([{until:0},{},{keep:false},{},{until:0},{}]),original=f.items;
 const survivors=[f.items[1],f.items[3],f.items[5]];
 assert.equal(compactEffectItems(f.items,1,false,f.step,f.context,.01,null),3);
 assert.equal(f.items,original);assert.deepEqual(f.items,survivors);
 assert.deepEqual(f.visited,[1,2,3,5]);assert.deepEqual(f.released,[0,2,4]);
});

test('strict expiry boundary is preserved; inactive frames still remove expired effects',()=>{
 const f=fixture([{until:5},{until:4.99},{until:Infinity}]);
 assert.equal(compactEffectItems(f.items,5,false,f.step,f.context,0),1);
 assert.deepEqual(f.items.map(x=>x.mesh.id),[0,2]);
 assert.deepEqual(f.visited,[0,2]);assert.deepEqual(f.released,[1]);
 compactEffectItems(f.items,5.01,false,f.step,f.context,0);
 assert.deepEqual(f.items.map(x=>x.mesh.id),[2]);assert.deepEqual(f.released,[1,0]);
});

test('blood off removes particles and marks before their visitor, not unrelated effects',()=>{
 const f=fixture([{kind:'blood'},{kind:'casing'},{kind:'bloodMark'},{}]);
 assert.equal(compactEffectItems(f.items,1,true,f.step,f.context,.016),2);
 assert.deepEqual(f.visited,[1,3]);assert.deepEqual(f.released,[0,2]);
 assert.deepEqual(f.items.map(x=>x.kind),['casing','dust']);
});

test('every adjacent collision/expiry releases once and visitor receives exact frame arguments',()=>{
 const f=fixture([{keep:false},{keep:false},{until:-1},{},{}]),camera={tag:'camera'};
 const called=[];
 function step(item,dt,cam){
  assert.equal(this,f.context);assert.equal(dt,.023);assert.equal(cam,camera);
  called.push(item.mesh.id);return item.keep!==false;
 }
 compactEffectItems(f.items,0,false,step,f.context,.023,camera);
 assert.deepEqual(called,[0,1,3,4]);assert.deepEqual(f.released,[0,1,2]);
 assert.equal(clearEffectItems(f.items),2);assert.equal(clearEffectItems(f.items),0);
 assert.deepEqual(f.released,[0,1,2,3,4]);
});

test('780 simultaneous expirations require one read pass, no snapshots, scans or splice shifts',()=>{
 const f=fixture(Array.from({length:780},()=>({until:1})));
 let reads=0,writes=0,iteratorReads=0;
 const watched=new Proxy(f.items,{
  get(target,key,receiver){
   if(key===Symbol.iterator){iteratorReads++;throw Error('snapshot/iterator allocation forbidden');}
   if(['indexOf','splice','slice','filter','map'].includes(key))throw Error('quadratic/copy operation '+key);
   if(typeof key==='string'&&/^\d+$/.test(key))reads++;
   return Reflect.get(target,key,receiver);
  },
  set(target,key,value,receiver){if(key!=='length')writes++;return Reflect.set(target,key,value,receiver);}
 });
 assert.equal(compactEffectItems(watched,2,false,f.step,f.context),780);
 assert.equal(reads,780);assert.equal(writes,0);assert.equal(iteratorReads,0);
 assert.equal(f.released.length,780);assert.equal(new Set(f.released).size,780);
 assert.equal(f.visited.length,0);assert.equal(f.items.length,0);
});

test('600 unchanged lifecycle refreshes do not rewrite or replace the active array',()=>{
 const f=fixture(Array.from({length:12},()=>({until:Infinity})));
 let writes=0;
 const watched=new Proxy(f.items,{set(target,key,value,receiver){writes++;return Reflect.set(target,key,value,receiver);}});
 for(let frame=0;frame<600;frame++)compactEffectItems(watched,frame/60,false,f.step,f.context,0);
 assert.equal(writes,0);assert.equal(f.released.length,0);
 assert.equal(f.visited.length,7200);assert.equal(watched.length,12);
});

test('mixed deterministic lifetimes match a reference filter across many frames and clears',()=>{
 let seed=3817;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let run=0;run<30;run++){
  const specs=Array.from({length:60},()=>({kind:next()<.4?'blood':'casing',until:Math.floor(next()*12),keep:next()>.2}));
  const f=fixture(specs),original=f.items;
  let expected=[...f.items];
  for(let t=0;t<14;t++){
   const off=t>=8;
   expected=expected.filter(it=>!(off&&it.kind.startsWith('blood'))&&!(t>it.until)&&it.keep!==false);
   compactEffectItems(f.items,t,off,f.step,f.context,.016);
   assert.equal(f.items,original);assert.deepEqual(f.items,expected);
  }
  assert.equal(new Set(f.released).size,60);assert.equal(f.released.length,60);
 }
});
