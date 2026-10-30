const assert=require('node:assert/strict');
/** Exercise the shipped controls, persistence and recap on the actual game. */
async function runComfortChecks(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:90000});
  await page.locator('#menu .comfort-settings summary').click();
  const sensitivity=page.locator('#menu [data-preference="sensitivity"]');
  await sensitivity.fill('1.5');
  await page.locator('#menu [data-preference="fov"]').fill('91');
  await page.locator('#menu [data-preference="quality"]').selectOption('performance');
  await page.locator('#menu [data-preference="motion"]').selectOption('reduced');
  const saved=await page.evaluate(()=>window.__hissrumDiagnostics().preferences);
  assert.deepEqual(saved,{sensitivity:1.5,fov:91,quality:'performance',motion:'reduced'});
  assert.equal(await page.locator('#pause [data-preference="sensitivity"]').inputValue(),'1.5');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:90000});
  assert.deepEqual(await page.evaluate(()=>window.__hissrumDiagnostics().preferences),saved);
  await page.locator('#audio-mode').selectOption('off');
  await page.locator('#loadout').selectOption('sniper');
  await page.locator('#start').tap();
  await page.waitForSelector('#hud:not([hidden])');
  await page.waitForFunction(()=>Math.abs(window.__hissrumDiagnostics().fov-91)<.1);
  const viewport=await page.evaluate(()=>window.__hissrumDiagnostics().viewport);
  assert.ok(Math.abs(viewport.pixelWidth-viewport.canvas.width*.85)<2);
  assert.ok(Math.abs(viewport.reticle.x-(viewport.canvas.x+viewport.canvas.width/2))<1);
  await page.locator('#pause-button').tap();
  await page.locator('#pause .comfort-settings summary').tap();
  const fov=page.locator('#pause [data-preference="fov"]');
  await fov.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await fov.inputValue(),'92','paused keyboard must not swallow range arrows');
  const before=await page.evaluate(()=>window.__hissrumDiagnostics());
  await page.waitForTimeout(650);
  const after=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(after.simulationTime,before.simulationTime);
  assert.ok(after.renderCalls-before.renderCalls<=16,'paused scene must stay at <=10 frames/s (two render passes)');
  await page.screenshot({path:'hissrum-strike-comfort.png',timeout:90000});
  await page.locator('#resume').tap();
  await page.waitForFunction(()=>Math.abs(window.__hissrumDiagnostics().fov-92)<.1);
  await page.locator('#scope-toggle').tap();
  await page.waitForFunction(()=>window.__hissrumDiagnostics().fov<19.2);
  await page.locator('#scope-toggle').tap();
  assert.equal(await page.evaluate(()=>window.__hissrumVisualTest.previewFatalHit()),true);
  await page.waitForSelector('#life-card:not([hidden])');
  assert.match(await page.locator('#life-title').textContent(),/UTSLAGEN AV C-/);
  assert.match(await page.locator('#life-detail').textContent(),/AR-47.*träffar.*skada/);
  assert.equal(await page.locator('#touch-controls').isVisible(),false,'no unusable controls over the death recap');
  await page.screenshot({path:'hissrum-strike-death-recap.png',timeout:90000});
  await page.waitForSelector('#life-card',{state:'hidden',timeout:30000});
  // No real enemy moves are revealed by the recap. Rotation preserves the
  // reduced backbuffer and the same CSS canvas/reticle coordinate system.
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>window.__hissrumDiagnostics().viewport.canvas.width>800);
  const landscape=await page.evaluate(()=>window.__hissrumDiagnostics().viewport);
  assert.ok(Math.abs(landscape.reticle.x-landscape.canvas.width/2)<1);
  assert.ok(Math.abs(landscape.pixelWidth-landscape.canvas.width*.85)<2);
  await page.locator('#pause-button').tap();
  await page.locator('#pause [data-reset-preferences]').click();
  assert.deepEqual(await page.evaluate(()=>window.__hissrumDiagnostics().preferences),{sensitivity:1,fov:84,quality:'balanced',motion:'system'});
  assert.deepEqual(errors,[]);
  console.log('PASS: actual comfort controls, reload persistence, keyboard range input, paused rendering budget, sniper FOV, real damage recap and landscape reticle');
 }finally{await context.close();}
}
module.exports={runComfortChecks};
