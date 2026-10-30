const assert=require('node:assert/strict');
async function runControlUI(browser,url){
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:90000});
   await page.locator('#mode').selectOption('control');await page.locator('#audio-mode').selectOption('off');
   await page.locator('#start').click();
   await page.waitForFunction(()=>window.__hissrumDiagnostics().control?.markerVisible,null,{timeout:30000});
   const control=await page.evaluate(()=>window.__hissrumDiagnostics().control);
   assert.equal(control.zones.length,3);assert.equal(control.phase,'active');
   assert.match(await page.locator('#round').textContent(),/KONTROLLZON/);
   assert.match(await page.locator('#mission').textContent(),/BYTE/);
   if(mobile)assert.equal(await page.locator('#touch-controls').isVisible(),true);
   await page.screenshot({path:'hissrum-strike-control-'+(mobile?'mobile':'desktop')+'.png'});
   if(!mobile)await page.evaluate(()=>document.exitPointerLock());
   if(!await page.locator('#pause').isVisible())await page.locator('#pause-button').click();
   await page.locator('#back-menu').click();await page.locator('#mode').selectOption('endless');await page.locator('#start').click();
   await page.waitForFunction(()=>window.__hissrumDiagnostics().control===null);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('PASS: control mode selector, reachable zone markers, mobile HUD and return to Endless');
}
module.exports={runControlUI};
