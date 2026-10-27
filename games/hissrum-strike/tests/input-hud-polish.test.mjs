import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickAxes,bindOwnedPointer,bindTouchControls} from '../src/touch-controls.mjs';
import {KillFeedView,drawPlayerHeading} from '../src/hud-polish.mjs';

class Element{
 constructor(){this.listeners=new Map();this.captured=new Set();this.style={};this.dataset={};this.layoutReads=0;this.offsetWidth=38;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type,id=1,props={}){const e={pointerId:id,button:0,clientX:49,clientY:49,preventDefault(){this.prevented=true;},...props};
   for(const fn of this.listeners.get(type)||[])fn(e);return e;}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.emit('lostpointercapture',id);}
 getBoundingClientRect(){this.layoutReads++;return {left:0,top:0,width:98,height:98};}
}

test('single owner prevents a second finger stealing or releasing a held control',()=>{
 const el=new Element();let starts=0,moves=0,ends=0;
 const binding=bindOwnedPointer(el,{start:()=>starts++,move:()=>moves++,end:()=>ends++});
 el.emit('pointerdown',1);el.emit('pointerdown',2);el.emit('pointermove',2);el.emit('pointerup',2);
 assert.equal(binding.pointerId,1);assert.equal(starts,1);assert.equal(ends,0);assert.equal(moves,0);
 el.emit('pointermove',1);assert.equal(moves,1);
 el.emit('pointerup',1);assert.equal(ends,1);assert.equal(binding.pointerId,null);
 el.emit('lostpointercapture',1);assert.equal(ends,1,'end must be idempotent');
});
test('cancel, lost capture, disabled controls and failed captures never leave held input',()=>{
 for(const terminal of ['pointerup','pointercancel','lostpointercapture']){
   const el=new Element();let held=false;
   const binding=bindOwnedPointer(el,{start:()=>held=true,end:()=>held=false});
   el.emit('pointerdown',7);assert.equal(held,true);el.emit(terminal,7);
   assert.equal(held,false);assert.equal(binding.pointerId,null);
   el.emit('pointermove',7);assert.equal(held,false);
 }
 const el=new Element();let enabled=false,pressed=0;
 const binding=bindOwnedPointer(el,{enabled:()=>enabled,start:()=>pressed++});
 el.emit('pointerdown');assert.equal(pressed,0);
 enabled=true;el.setPointerCapture=()=>{throw Error('inactive pointer');};
 assert.doesNotThrow(()=>el.emit('pointerdown'));assert.equal(pressed,0);assert.equal(binding.pointerId,null);
});
test('reset during action, delayed release and disposal cannot re-arm old pointers',()=>{
 const el=new Element();let moves=0,ends=0,binding;
 binding=bindOwnedPointer(el,{start:()=>binding.reset(),move:()=>moves++,end:()=>ends++});
 el.emit('pointerdown',3);assert.equal(binding.pointerId,null);assert.equal(ends,1);
 el.emit('pointermove',3);el.emit('pointerup',3);assert.equal(moves,0);assert.equal(ends,1);
 binding.dispose();el.emit('pointerdown',4);assert.equal(binding.pointerId,null);
});
test('joystick dead zone rejects micro-drift and radial diagonal speed is bounded',()=>{
 assert.deepEqual(joystickAxes(2,1),{strafe:0,forward:0});
 const right=joystickAxes(45,0);assert.equal(right.strafe,1);assert.equal(right.forward,0);
 const diagonal=joystickAxes(100,-100);assert.ok(Math.abs(Math.hypot(diagonal.strafe,diagonal.forward)-1)<1e-12);
 assert.ok(diagonal.strafe>0&&diagonal.forward>0);
 assert.deepEqual(joystickAxes(NaN,5),{strafe:0,forward:0});
});
test('independent move/look/fire fingers reset together with only one layout read per gesture',()=>{
 const pad=new Element(),stick=new Element(),look=new Element(),fire=new Element();fire.dataset.touch='fire';
 let axes=[],delta=[],held=false,enabled=true;
 const touch=bindTouchControls({pad,stick,look,buttons:[fire],enabled:()=>enabled,
   onMove:(...v)=>axes=v,onLook:(...v)=>delta=v,onPress:()=>held=true,onRelease:()=>held=false});
 pad.emit('pointerdown',1);look.emit('pointerdown',2);fire.emit('pointerdown',3);
 for(let i=0;i<200;i++)pad.emit('pointermove',1,{clientX:85,clientY:27});
 assert.equal(pad.layoutReads,1,'no layout reads per pointermove');assert.ok(axes[0]>0&&axes[1]>0);
 look.emit('pointermove',2,{clientX:59,clientY:39});assert.deepEqual(delta,[10,-10]);assert.equal(held,true);
 touch.reset();assert.deepEqual(axes,[0,0]);assert.equal(held,false);assert.equal(stick.style.transform,'translate(0,0)');
 pad.emit('pointermove',1,{clientX:90});look.emit('pointermove',2,{clientX:90});
 assert.deepEqual(axes,[0,0]);assert.deepEqual(delta,[10,-10]);
 enabled=false;pad.emit('pointerdown',4);assert.deepEqual(axes,[0,0]);
 enabled=true;pad.emit('pointerdown',5);assert.equal(pad.layoutReads,2);
 touch.dispose();assert.deepEqual(axes,[0,0]);
});

function feedFixture(){
 const count={elements:0,writes:0,appends:0};
 const doc={createElement(){count.elements++;const values={hidden:false,textContent:'',className:''},node={};
   for(const k of Object.keys(values))Object.defineProperty(node,k,{get:()=>values[k],set:v=>{values[k]=v;count.writes++;}});
   return node;}};
 const container={ownerDocument:doc,children:[],append(n){count.appends++;this.children.push(n);}};
 return {count,container};
}
test('kill feed reuses five nodes and makes zero DOM writes for 600 unchanged refreshes',()=>{
 const {count,container}=feedFixture(),view=new KillFeedView(container);
 const items=Array.from({length:5},(_,i)=>({name:`A-${i} × C-${i}`,team:'analysts'}));
 view.render(items);const nodes=[...container.children],writes=count.writes;
 for(let i=0;i<600;i++)view.render(items);
 assert.equal(count.elements,5);assert.equal(count.appends,5);assert.equal(count.writes,writes);
 assert.deepEqual(container.children,nodes);
 view.render(items.slice(0,2));assert.equal(container.children.filter(n=>!n.hidden).length,2);
 view.render([]);assert.ok(container.children.every(n=>n.hidden));
 view.render([{name:'<b>not HTML</b>',team:'counterAnalysts'}]);
 assert.equal(container.children[0].textContent,'<b>not HTML</b>');assert.equal(container.children[0].className,'');
 assert.equal(count.elements,5);
});
test('minimap heading rotates as a rigid triangle and does not depend on flight altitude',()=>{
 function vertices(yaw){const points=[];
   drawPlayerHeading({beginPath(){},moveTo:(x,y)=>points.push([x,y]),lineTo:(x,y)=>points.push([x,y]),closePath(){},fill(){}},0,0,yaw);
   return points;
 }
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const base=vertices(0);assert.deepEqual(base[0],[0,-7]);
 for(const angle of [Math.PI/2,Math.PI,-Math.PI/2,.47]){
   const pts=vertices(angle);assert.ok(Math.abs(pts[0][0]+Math.sin(angle)*7)<1e-12);
   assert.ok(Math.abs(pts[0][1]+Math.cos(angle)*7)<1e-12);
   for(let i=0;i<3;i++)assert.ok(Math.abs(distance(pts[i],pts[(i+1)%3])-distance(base[i],base[(i+1)%3]))<1e-12);
 }
 assert.deepEqual(vertices(NaN),base);
});
