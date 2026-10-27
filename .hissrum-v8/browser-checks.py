from pathlib import Path
p=Path('games/hissrum-strike/tests/browser-smoke.cjs')
c=p.read_text()
def change(a,b):
 global c
 assert a in c,a[:90]
 c=c.replace(a,b,1)
change("  assert.ok(diag.authoredVisuals>=10,'all bots/hostages must use the skinned Quaternius characters');", """  assert.ok(diag.authoredVisuals>=10,'all bots/hostages must use the skinned Quaternius characters');
  assert.equal(diag.allyMarkersEnabled,true);
  assert.ok(diag.combatPresentation.markerIds.length>0,'living teammates need HUD markers');
  assert.ok(diag.combatPresentation.markerIds.every(id=>id.startsWith('analysts-')&&id!=='analysts-0'),
    'opponents must never receive ally markers');
  const feedback=await page.evaluate(()=>{
    const before=window.__hissrumDiagnostics();window.__hissrumVisualTest.previewCombatFeedback();
    const after=window.__hissrumDiagnostics();return {before,after};
  });
  assert.equal(feedback.after.combatPresentation.hitKind,'kill');
  assert.equal(feedback.after.combatPresentation.damageDirections,1);
  assert.equal(feedback.after.combatPresentation.medalTitle,'DOUBLE ELIMINATION');
  assert.equal(feedback.after.money,feedback.before.money,'presentation must not add credits');
  assert.equal(await page.locator('#combat-hit-label').textContent(),'HUVUDTRÄFF · UTSLAGEN');
  await page.keyboard.press('Tab');
  await page.waitForSelector('#scoreboard:not([hidden])',{timeout:10000});
  assert.equal(await page.locator('#scoreboard-rows tr[data-actor]').count(),10);
  assert.equal(await page.locator('#scoreboard-rows .is-player').count(),1);
  const stopped=(await page.evaluate(()=>window.__hissrumDiagnostics())).simulationTime;
  await page.waitForTimeout(180);
  assert.equal((await page.evaluate(()=>window.__hissrumDiagnostics())).simulationTime,stopped);
  await page.keyboard.press('Tab');
  await page.waitForFunction(()=>!window.__hissrumDiagnostics().scoreboardOpen,null,{timeout:10000});
  console.log('PASS: Riposte-inspired hostile hit feedback, immutable shot direction, teammate-only markers and authoritative 10-row scoreboard');""")
change("  assert.equal(await page.locator('#scope-overlay').isVisible(),true);", """  assert.equal(await page.locator('#scope-overlay').isVisible(),true);
  await page.waitForFunction(()=>document.getElementById('ally-marks').hidden,null,{timeout:10000});""")
change("  assert.deepEqual(issues,[],'Unexpected browser errors/network failures');", """  // Readability controls are deliberately kept out of the mobile aiming area.
  await mobile.locator('#scoreboard-button').tap();
  await mobile.waitForSelector('#scoreboard:not([hidden])',{timeout:15000});
  assert.equal(await mobile.locator('#scoreboard-rows tr[data-actor]').count(),10);
  const scoreBounds=await mobile.locator('.score-card').boundingBox();
  assert.ok(scoreBounds.width<=390&&scoreBounds.x>=0,'scoreboard fits portrait width');
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-scoreboard-mobile.png'});
  await mobile.locator('#scoreboard-close').tap();
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#ally-marks-pause').selectOption('off');
  await mobile.locator('#combat-feedback-pause').selectOption('off');
  await mobile.locator('#resume').tap();
  let simple=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(simple.allyMarkersEnabled,false);assert.equal(simple.combatFeedbackEnabled,false);
  assert.equal(await mobile.locator('#ally-marks').isVisible(),false);
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#ally-marks-pause').selectOption('on');
  await mobile.locator('#combat-feedback-pause').selectOption('on');
  await mobile.locator('#auto-fire-pause').selectOption('manual');
  await mobile.locator('#resume').tap();
  await mobile.evaluate(()=>window.__hissrumVisualTest.prepareAutoFire('smg'));
  await mobile.locator('[data-touch="fire"]').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().magazine<30,null,{timeout:45000});
  await mobile.locator('[data-touch="reload"]').tap();
  await mobile.waitForFunction(()=>!document.getElementById('reload-meter').hidden,null,{timeout:15000});
  assert.ok(Number(await mobile.locator('#reload-meter').getAttribute('aria-valuenow'))>=0);
  await mobile.evaluate(()=>window.__hissrumVisualTest.previewCombatFeedback());
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-combat-feedback.png'});
  console.log('PASS: Mobile scoreboard toggle, readable reload progress, persistent ally/feedback preferences and no extra aiming buttons');
  assert.deepEqual(issues,[],'Unexpected browser errors/network failures');""")
p.write_text(c)
w=Path('.github/workflows/hissrum-strike.yml')
s=w.read_text().replace('            hissrum-strike-blood-dwarfs.png','            hissrum-strike-blood-dwarfs.png\n            hissrum-strike-scoreboard-mobile.png\n            hissrum-strike-combat-feedback.png');w.write_text(s)
