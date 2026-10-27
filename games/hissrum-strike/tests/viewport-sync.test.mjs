import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createGameViewportSync,measureGameCanvas} from '../src/viewport-sync.mjs';

test('reticle origin is the actual 3D canvas center, not outer mobile viewport',()=>{
 // Reproduce the reported landscape bug: stale renderer width 659px inside
 // a 768px phone viewport. A 50vw reticle would point 54.5px off-target.
 const correct=measureGameCanvas({left:0,top:0,width:659,height:353});
 assert.equal(correct.aimX,329.5);
 assert.equal(correct.aimY,176.5);
 assert.notEqual(correct.aimX,768/2);
});

test('renderer resizes the backbuffer without overriding responsive CSS',()=>{
 const dims={left:0,top:0,width:659,height:353};
 const hud={left:0,top:0,width:768,height:353};
 const canvas={style:{width:'',height:''},getBoundingClientRect:()=>({...dims})};
 const calls=[],updates=[],values={};
 const renderer={setSize:(w,h,updateStyle)=>{
   calls.push([w,h,updateStyle]);
   // Three.js normally writes an inline CSS size unless updateStyle=false.
   if(updateStyle!==false){canvas.style.width=w+'px';canvas.style.height=h+'px';}
 }};
 const camera={aspect:1,updateProjectionMatrix(){updates.push(this.aspect);}};
 const weapon={aspect:1,updateProjectionMatrix(){updates.push(this.aspect);}};
 const root={style:{setProperty:(k,v)=>{values[k]=v;}}};
 const sync=createGameViewportSync({canvas,renderer,cameras:[camera,weapon],root,overlay:{getBoundingClientRect:()=>({...hud})}});
 assert.equal(sync().aimX,329.5);
 assert.deepEqual(calls,[[659,353,false]]);
 assert.equal(canvas.style.width,'');
 assert.equal(values['--aim-shift-x'],'-54.5px');
 assert.equal(values['--aim-shift-y'],'0px');
 assert.equal(camera.aspect,659/353);
 assert.equal(weapon.aspect,camera.aspect);
 assert.equal(sync().width,659);
 assert.equal(calls.length,1,'unchanged viewport does not reallocate GPU backbuffer');
 assert.equal(updates.length,2,'unchanged viewport does not rebuild matrices');
 dims.width=768;
 assert.equal(sync().aimX,384);
 assert.deepEqual(calls.at(-1),[768,353,false]);
 assert.equal(values['--aim-shift-x'],'0px');
 assert.equal(camera.aspect,768/353);
 assert.equal(weapon.aspect,camera.aspect);
 assert.equal(canvas.style.width,'');
 dims.width=390;dims.height=844;hud.width=390;hud.height=844;
 assert.equal(sync().aimY,422);
 assert.deepEqual(calls.at(-1),[390,844,false]);
 assert.equal(values['--aim-shift-y'],'0px');
 assert.equal(calls.length,3);
});

test('CSS owns canvas layout and centers aiming HUD on the camera axis',()=>{
 const css=readFileSync(resolve(fileURLToPath(new URL('../style.css',import.meta.url))),'utf8');
 assert.match(css,/#scene\{[^}]*position:fixed;inset:0;width:100%;height:100dvh;/);
 for(const selector of ['#crosshair','#hit','#damage-compass','#scope-overlay .scope-reticle']){
   const start=css.indexOf(selector+'{');
   assert.ok(start>=0,selector+' rule exists');
   const rule=css.slice(start,css.indexOf('}',start)+1);
   assert.ok(rule.includes('left:calc(50% + var(--aim-shift-x,0px))'),selector+' follows responsive HUD X');
   assert.ok(rule.includes('top:calc(50% + var(--aim-shift-y,0px))'),selector+' follows responsive HUD Y');
 }
});

test('invalid canvas rectangles do not trigger GPU or DOM writes',()=>{
 const root={style:{setProperty(){throw Error('invalid bounds touched root');}}};
 const renderer={setSize(){throw Error('invalid bounds resized GPU');}};
 const sync=createGameViewportSync({
   canvas:{getBoundingClientRect:()=>({left:0,top:0,width:0,height:353})},
   renderer,cameras:[],root
 });
 assert.equal(sync(),null);
 assert.equal(measureGameCanvas({left:0,top:0,width:NaN,height:353}),null);
});
