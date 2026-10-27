/* Real Chromium pointer/capture lifecycle. Does not change game health or rules. */
const assert=require('node:assert/strict');
async function runInputHudPolishChecks(page,context){
 const touch=await context.newCDPSession(page);
 const point=(b,id,x=.5,y=.5)=>({id,x:b.x+b.width*x,y:b.y+b.height*y});
 const input=()=>page.evaluate(()=>window.__hissrumDiagnostics().touchInput);
 await page.evaluate(()=>{
   window.__polishPointer=null;
   document.getElementById('move-pad').addEventListener('pointerdown',e=>window.__polishPointer=e.pointerId);
   window.__polishFeedNodes=[...document.querySelector('#killfeed').children];
 });
 try{
   const pad=await page.locator('#move-pad').boundingBox();assert.ok(pad);
   const first=point(pad,41,.5,.10),second=point(pad,42,.5,.9);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
   await page.waitForFunction(()=>window.__hissrumDiagnostics().touchInput.forward>.5,null,{timeout:20000});
   const held=await input();
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
   assert.equal((await input()).forward,held.forward,'second finger must not steal joystick');
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
   assert.equal((await input()).forward,held.forward,'other finger release must not release joystick owner');
   await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal((await input()).forward,0,'OS cancel must neutralize joystick');

   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
   // Apply pending capture first; cancelling a pending request emits no loss event.
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,x:first.x+1}]});
   await page.evaluate(()=>document.getElementById('move-pad').releasePointerCapture(window.__polishPointer));
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,x:first.x+2}]});
   assert.equal((await input()).forward,0,'lost capture must neutralize held movement');
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

   const fire=await page.locator('[data-touch="fire"]').boundingBox();assert.ok(fire);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(fire,43)]});
   assert.equal((await input()).fire,true);
   await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal((await input()).fire,false,'cancelled fire must not keep firing');

   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
   await page.evaluate(()=>document.getElementById('pause-button').click());
   assert.equal((await input()).forward,0);
   await page.evaluate(()=>document.getElementById('resume').click());
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,x:first.x+2}]});
   assert.equal((await input()).forward,0,'old gesture cannot restart movement after resume');
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
   assert.ok((await input()).forward>.5,'fresh gesture works after reset');
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

   const stable=await page.evaluate(()=>{
     const nodes=[...document.querySelector('#killfeed').children];
     const unchanged=nodes.length===5&&nodes.every((n,i)=>n===window.__polishFeedNodes[i]);
     delete window.__polishFeedNodes;return unchanged;
   });
   assert.equal(stable,true,'killfeed must keep its five pooled rows across HUD refreshes');
   console.log('PASS: owned multitouch, actual capture loss/cancel, pause-safe controls and pooled killfeed nodes');
 }finally{
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});
   await touch.detach();
 }
}
module.exports={runInputHudPolishChecks};
