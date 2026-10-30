/* GLB-backed browser regression: real model, floor alignment, furniture visibility,
   5v5 round, touch hit targets, portrait gameplay, pause and image contrast. */
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
const {runComfortChecks}=require('./comfort-browser-checks.cjs');
const {runInputHudPolishChecks}=require('./input-hud-browser.cjs');
const {spawn}=require('node:child_process');
const {setTimeout:sleep}=require('node:timers/promises');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..'),port=8932;
const url='http://127.0.0.1:'+port+'/games/hissrum-strike/?test=1';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'pipe'});
async function ready(){
 for(let i=0;i<40;i++){
  const ok=await new Promise(resolve=>http.get('http://127.0.0.1:'+port+'/',res=>{
   res.resume();resolve(res.statusCode<500);
  }).on('error',()=>resolve(false)));
  if(ok)return;
  await sleep(250);
 }
 throw Error('HTTP test server did not start');
}
function imageMetrics(bytes){
 const img=PNG.sync.read(bytes);
 const {width:w,height:h,data}=img;
 let sum=0,square=0,n=0,high=0,low=0;
 // Center crop avoids menu/HUD without hiding an empty/dark gameplay world.
 for(let y=Math.floor(h*.31);y<Math.floor(h*.69);y+=3)
  for(let x=Math.floor(w*.28);x<Math.floor(w*.72);x+=3){
   const i=4*(y*w+x),brightness=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);
   sum+=brightness;square+=brightness*brightness;n++;
   if(brightness>70)high++;
   if(brightness<15)low++;
  }
 const mean=sum/n,std=Math.sqrt(Math.max(0,square/n-mean*mean));
 return {mean:+mean.toFixed(2),std:+std.toFixed(2),brightFraction:+(high/n).toFixed(3),nearBlackFraction:+(low/n).toFixed(3)};
}
function overlap(a,b){
 return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
}
async function attachLogs(page,tag,issues){
 page.on('pageerror',e=>{issues.push(e.message);console.error('['+tag+' exception] '+e.stack);});
 page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
 page.on('requestfailed',r=>{issues.push('request '+r.url()+': '+r.failure()?.errorText);});
}
async function launchReadyPage(context,tag,issues){
 const page=await context.newPage();
 await attachLogs(page,tag,issues);
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>!document.querySelector('#start').disabled||
     document.querySelector('#loading').classList.contains('failed'),null,{timeout:90000});
 assert.equal(await page.locator('#loading').evaluate(e=>e.classList.contains('failed')),false,
   '['+tag+'] '+await page.locator('#loading-text').textContent());
 return page;
}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
   '--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  await runComfortChecks(browser,url);
  const issues=[];
  const desktop=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const page=await launchReadyPage(desktop,'desktop',issues);
  await page.locator('#loadout').selectOption('sniper');
  await page.locator('#start').click();
  await page.waitForSelector('#hud:not([hidden])');
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.authoredVisuals>=10,null,{timeout:90000});
  const diag=await page.evaluate(()=>window.__hissrumDiagnostics());
  console.log('DESKTOP ROOM DIAGNOSTICS '+JSON.stringify({scale:diag.scale,player:diag.player,room:diag.stats.roomExtent,
    modelFloor:diag.floorReference,spawn:diag.stats.playerSpawn,
    visibleProps:diag.namedProps.filter(p=>p.ndc[0]>-1&&p.ndc[0]<1&&p.ndc[1]>-1&&p.ndc[1]<1&&p.ndc[2]>0&&p.ndc[2]<1).slice(0,12)}));
  assert.ok(diag.namedProps.length>=10,'must load original furnishings, not a blank proxy scene');
  assert.equal(diag.characterModelReady,true,'Cartridge Strike GLB avatars must load');
  assert.ok(diag.authoredVisuals>=10,'all bots/hostages must use the skinned Quaternius characters');
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
  console.log('PASS: Riposte-inspired hostile hit feedback, immutable shot direction, teammate-only markers and authoritative 10-row scoreboard');
  assert.equal(diag.weaponModel,'sniper','original Scope 5 mesh must be selected');
  assert.equal(diag.viewmodelSource,'capstere/cartridge-strike');
  assert.equal(diag.viewmodelType,'fitted-gloves');
  // All 10 start positions are authored navigation nodes, widely spaced.
  const spawnPoints=[...diag.anchors.analysts,...diag.anchors.counterAnalysts];
  assert.equal(spawnPoints.length,10);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const minSpawnGap=Math.min(...spawnPoints.flatMap((a,i)=>spawnPoints.slice(i+1).map(b=>dist(a,b))));
  assert.ok(minSpawnGap>3.0,'five-on-five team spawns are still uncomfortably bunched: '+minSpawnGap);
  const squadRange=Math.max(...diag.anchors.analysts.flatMap(a=>diag.anchors.analysts.map(b=>dist(a,b))));
  assert.ok(squadRange>8,'Analysts must start more widely distributed around Hissrum V5');
  assert.equal(diag.dwarfCount,8,'eight original fantasy dwarfs must spawn inside Hissrum V5');
  assert.equal(diag.botFlightEnabled,true,'AI vertical navigation must be on by default');
  assert.equal(diag.tacticalAIEnabled,true,'bots should use real-room tactical planning');
  assert.ok(diag.tacticalBots.length>=9,'every opponent and teammate bot should own a tactical controller');
  assert.ok(diag.tacticalBots.every(b=>Number.isFinite(b.goal?.x)||
    b.goal===null),'tactical bot goals must remain finite or be intentionally held');
  assert.ok(diag.visibleDwarfs>=8,'Cartridge Strike dwarf meshes must actually be instanced');
  assert.ok(diag.tapeCollidersExcluded>=1,'adhesive floor tape should remain visible but never enter Octree collision');
  assert.ok((await page.locator('#weapon').textContent()).includes('Scope 5'),'sniper selected in Game');
  assert.ok(diag.namedProps.some(p=>/CREFORM-vagn/i.test(p.name)),
    'named landmarks must use human-readable original cart names, not only V4 primitive IDs');
  const lead=diag.anchors.analysts[0],fx=-Math.sin(lead.yaw),fz=-Math.cos(lead.yaw);
  for(const ally of diag.anchors.analysts.slice(1)){
    const dist=Math.hypot(ally.x-lead.x,ally.z-lead.z);
    const inFront=(ally.x-lead.x)*fx+(ally.z-lead.z)*fz;
    assert.ok(dist>=10||inFront<=-.65,'nearby teammate blocks player sightline to CREFORM');
  }
  assert.ok(Math.abs(diag.floorReference)<.12,'floor reference cannot be bottom of room substructure');
  assert.ok(diag.player&&Math.abs(diag.player.y)<.3,'player must stand ON real floor, not under it');
  assert.ok(Math.abs(diag.player.yaw-diag.anchors.analysts[0].yaw)<.16,
    'pointer-lock acquisition must not swing camera away from the intended GLB landmarks');
  assert.ok(diag.player.eye>1.1&&diag.player.eye<3.5,'first-person camera must be above floor');
  assert.ok(diag.stats.roomExtent.z<55,'elevator cabin must not expand the playable arena');
  assert.ok(diag.namedProps.some(p=>p.ndc.every(Number.isFinite)&&Math.abs(p.ndc[0])<.9&&Math.abs(p.ndc[1])<.9&&p.ndc[2]>0&&p.ndc[2]<1),
   'real named GLB carts/pallets must be IN FRONT of camera');
  const shot=await page.screenshot({timeout:90000,path:'hissrum-strike-browser.png'});
  const desktopMetrics=imageMetrics(shot);console.log('DESKTOP IMAGE METRICS '+JSON.stringify(desktopMetrics));
  assert.ok(desktopMetrics.mean>25,'original-room gameplay is implausibly dark');
  assert.ok(desktopMetrics.std>11,'view lacks readable geometry/contrast');
  assert.ok(Number(await page.locator('#health').textContent())>=0);
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.decodedSounds>=15,null,{timeout:60000});
  let mediaStats=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(mediaStats.audioErrors.length,0,'authored CC0 sound samples should decode in Chromium');
  assert.equal(mediaStats.audioActive,true,'audio must unlock from the Start click');
  assert.equal(await page.evaluate(()=>window.__hissrumVisualTest.paintDamage()),true,
    'original bounded blood impact pool must respond to actual damage event format');
  assert.equal(await page.evaluate(()=>window.__hissrumVisualTest.previewSound()),true,
    'gunshot must reach the live positional audio engine');
  mediaStats=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(mediaStats.bloodHits>0,'blood FX statistics should update after damage');
  await page.screenshot({timeout:90000,path:'hissrum-strike-blood-dwarfs.png'});
  await page.keyboard.press('KeyM');
  assert.equal((await page.evaluate(()=>window.__hissrumDiagnostics())).soundEnabled,false,'M should mute');
  await page.keyboard.press('KeyM');
  assert.equal((await page.evaluate(()=>window.__hissrumDiagnostics())).soundEnabled,true,'M should unmute');
  console.log('AUDIO/BLOOD/DWARFS OK',JSON.stringify(mediaStats));
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(550);
  let scoped=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(scoped.scopeActive,true,'Z opens the sniper scope');
  assert.ok(scoped.fov<65,'sniper should actually zoom camera');
  assert.equal(await page.locator('#scope-overlay').isVisible(),true);
  await page.waitForFunction(()=>document.getElementById('ally-marks').hidden,null,{timeout:10000});
  await page.screenshot({timeout:90000,path:'hissrum-strike-sniper.png'});
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(100);
  // Switching to the original P9 must reveal REAL CC0 skinned first-person
  // hands, not the old procedural block-and-capsule weapon.
  await page.keyboard.press('Digit2');
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.weaponModel==='p9',null,{timeout:20000});
  const pistolVisual=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(pistolVisual.viewmodelSource,'capstere/cartridge-strike');
  assert.equal(pistolVisual.viewmodelType,'skinned-hands');
  assert.equal(pistolVisual.viewmodelSkinnedHands,true);
  await page.screenshot({timeout:90000,path:'hissrum-strike-p9-hands.png'});
  await page.keyboard.press('Digit1');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(110);
  const origin=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(origin.flying,true,'F enables flight');
  await page.keyboard.down('Space');
  // Software WebGL can render only a few frames per wall-clock second with
  // the full imported hand rig. Wait for actual simulation height change.
  await page.waitForFunction(target=>
    window.__hissrumDiagnostics()?.player?.y>target,
    origin.player.y+.085,{timeout:22000});
  await page.keyboard.up('Space');
  const ascended=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(ascended.player.y>origin.player.y+.07,'Space should ascend without jumping off tape');
  await page.waitForTimeout(210);
  const hovering=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(Math.abs(hovering.player.y-ascended.player.y)<.04,'hover should preserve altitude');
  await page.keyboard.down('Control');
  // Software-WebGL has highly variable frame times. Hold the key until an
  // ACTUAL downward physics step is observed, not for an arbitrary wall-clock
  // delay that can elapse between rendered frames.
  await page.waitForFunction(target=>
    window.__hissrumDiagnostics()?.player?.y < target,
    ascended.player.y-.045,{timeout:14000});
  await page.keyboard.up('Control');
  const descended=await page.evaluate(()=>window.__hissrumDiagnostics());
  console.log('FLIGHT PHYSICS',{start:origin.player.y,up:ascended.player.y,
    hovering:hovering.player.y,down:descended.player.y});
  assert.ok(descended.player.y<ascended.player.y-.04,'Ctrl descends in flight');
  await page.keyboard.press('KeyF');
  assert.equal((await page.evaluate(()=>window.__hissrumDiagnostics())).flying,false);
  console.log('PASS: Cartridge avatars, decorative non-solid tape, sniper scope zoom and keyboard hover flight');
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.flyingBots>0,null,{timeout:85000});
  assert.ok((await page.evaluate(()=>window.__hissrumDiagnostics())).flyingBots>=1,
    'bots must fly physically inside the 3D world, not only have a UI setting');
  const tactics=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(tactics.tacticalAIEnabled,true);
  assert.ok(tactics.tacticalBots.some(b=>b.aiState),'bots should choose mission or combat AI states');
  assert.ok(tactics.tacticalBots.filter(b=>b.flying).length<=4,
    'airborne bots stay within the four-flyer cap');
  console.log('TACTICAL AI GLB LIVE',JSON.stringify(tactics.tacticalBots.slice(0,8)));
  console.log('PASS: Autonomous tactical bot flight and role-based goals visible during real 5v5 simulation');
  await page.keyboard.press('KeyB');
  await page.waitForSelector('#shop:not([hidden])',{timeout:5000});
  const credits=(await page.evaluate(()=>window.__hissrumDiagnostics())).money;
  await page.locator('[data-buy="shotgun"]').click();
  let purchased=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(purchased.money,credits-1800);
  assert.equal(purchased.equippedWeapon,'shotgun');
  await page.locator('#shop-close').click();
  await page.waitForFunction(()=>!window.__hissrumDiagnostics().shopOpen);
  console.log('PASS: Desktop B opens real paid field arsenal during round');

  // Play the authored Death01 skeletal clip in the REAL miniature scene. It
  // must remain visible rather than instantly removing the dead bot's mesh.
  const dead=await page.evaluate(()=>window.__hissrumVisualTest.previewNpcDeath());
  assert.ok(dead,'there must be a living bot for the death scene');
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.deathAnimations>=1,null,{timeout:20000});
  console.log('PASS: Quaternius Death01 plays for fallen bots');
  assert.equal(await page.evaluate(()=>window.__hissrumVisualTest.previewPlayerDeath()),true);
  await page.waitForFunction(()=>window.__hissrumDiagnostics()?.playerDeathCamera===true,null,{timeout:20000});
  console.log("PASS: player's Death01 is visible in a short third-person fall");
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});

  const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
    isMobile:true,hasTouch:true});
  const mobile=await launchReadyPage(phone,'mobile',issues);
  await mobile.locator('#loadout').selectOption('sniper');
  await mobile.locator('#start').tap();
  await mobile.waitForSelector('#touch-controls:not([hidden])');
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics()?.authoredVisuals>=10,null,{timeout:90000});
  const mobileDiag=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(Math.abs(mobileDiag.player.y)<.3,'mobile player must stand ON the real floor');
  assert.equal(mobileDiag.characterModelReady,true);
  assert.equal(mobileDiag.autoFireEnabled,true,'mobile automatic fire must be default');
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),false,'no default fire button');
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#auto-fire-pause').selectOption('manual');
  await mobile.locator('#resume').tap();
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).autoFireEnabled,false);
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),true,'manual mode reveals fire button');

  assert.ok(mobileDiag.authoredVisuals>=10);
  assert.equal(mobileDiag.weaponModel,'sniper');
  assert.equal(mobileDiag.viewmodelSource,'capstere/cartridge-strike');
  assert.equal(mobileDiag.dwarfCount,8,'mobile game must initialize all dwarfs');
  assert.equal(mobileDiag.botFlightEnabled,true);
  assert.equal(mobileDiag.tacticalAIEnabled,true);
  assert.ok(mobileDiag.tacticalBots.length>=9);
  assert.ok(['reduced','standard'].includes(mobileDiag.bloodSetting));
  await mobile.locator('#sound-button').tap();
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).soundEnabled,false,
    'mobile mute target is tappable');
  await mobile.locator('#sound-button').tap();
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).soundEnabled,true);
  await mobile.locator('#flight-toggle').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().flying,null,{timeout:3000});
  assert.equal(await mobile.locator('#descend-button').isVisible(),true,'mobile downward flight control must appear');
  assert.equal(await mobile.locator('#jump-button').textContent(),'UPP','jump control becomes ascend');
  assert.equal(await mobile.locator('#scope-toggle').isVisible(),true,'sniper scope button must appear');
  await mobile.locator('#scope-toggle').tap();
  await mobile.waitForTimeout(360);
  const zoom=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(zoom.scopeActive,true);
  assert.ok(zoom.fov<76);
  await mobile.locator('#scope-toggle').tap();
  await mobile.waitForTimeout(120);

  // Regression: mobile landscape after portrait (Safari can leave Three.js's
  // prior setSize inline width behind, making the crosshair miss canvas center).
  async function checkAimAlignment(label,expectedWidth){
    // Safari and emulated Chromium can paint CSS with the NEW dimensions
    // before ResizeObserver has had a chance to update the WebGL cameras.
    // Wait for that backbuffer/projection update instead of assuming an
    // orientation change becomes synchronous with setViewportSize().
    await mobile.waitForFunction(expected=>{
      const v=window.__hissrumDiagnostics()?.viewport;
      if(!v)return false;
      return Math.abs(v.canvas.width-expected)<1 &&
        Math.abs(v.reticle.x-(v.canvas.x+v.canvas.width/2))<.6 &&
        Math.abs(v.reticle.y-(v.canvas.y+v.canvas.height/2))<.6 &&
        Math.abs(v.cameraAspect-v.canvas.width/v.canvas.height)<.005 &&
        Math.abs(v.weaponAspect-v.cameraAspect)<.005;
    },expectedWidth,{timeout:20000});
    const v=await mobile.evaluate(()=>window.__hissrumDiagnostics().viewport);
    const cx=v.canvas.x+v.canvas.width/2,cy=v.canvas.y+v.canvas.height/2;
    assert.ok(Math.abs(v.canvas.width-expectedWidth)<1,label+': wrong CSS canvas width '+v.canvas.width);
    assert.ok(Math.abs(v.reticle.x-cx)<.6,label+': horizontal crosshair offset '+(v.reticle.x-cx));
    assert.ok(Math.abs(v.reticle.y-cy)<.6,label+': vertical crosshair offset '+(v.reticle.y-cy));
    assert.ok(Math.abs(v.cameraAspect-v.canvas.width/v.canvas.height)<.005,label+': world camera aspect mismatch');
    assert.ok(Math.abs(v.weaponAspect-v.cameraAspect)<.005,label+': weapon camera aspect mismatch');
    assert.equal(v.inlineCanvasWidth,'',label+': WebGL must not set stale inline width');
    assert.equal(v.inlineCanvasHeight,'',label+': WebGL must not set stale inline height');
    assert.ok(v.pixelWidth>0&&v.pixelHeight>0,label+': rendering buffer exists');
    return v;
  }
  await checkAimAlignment('portrait',390);
  await mobile.setViewportSize({width:768,height:353});
  await mobile.waitForFunction(()=>Math.abs(document.querySelector('#scene').getBoundingClientRect().width-768)<1,
    null,{timeout:5000});
  await checkAimAlignment('rotated landscape',768);
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-landscape-crosshair.png'});
  await mobile.setViewportSize({width:390,height:844});
  await mobile.waitForFunction(()=>Math.abs(document.querySelector('#scene').getBoundingClientRect().width-390)<1,
    null,{timeout:5000});
  await checkAimAlignment('portrait restored',390);
  console.log('PASS: canvas, reticle, world/weapon cameras stay aligned through Safari-style portrait/landscape resizing');
  const rects=await mobile.evaluate(()=>{
    const ids=['move-pad','pause-button','health','ammo','look-zone','minimap'];
    const r={};
    for(const id of ids){const e=document.getElementById(id);const b=e.getBoundingClientRect();
      r[id]={x:b.x,y:b.y,width:b.width,height:b.height};}
    for(const value of ['fire','reload','jump','interact','switch','fly','descend','scope']){
      const b=document.querySelector('[data-touch='+value+']').getBoundingClientRect();
      r[value]={x:b.x,y:b.y,width:b.width,height:b.height};
    }
    const pause=r['pause-button'],target=document.elementFromPoint(pause.x+pause.width/2,pause.y+pause.height/2);
    return {r,pauseClickTarget:target?.id||target?.dataset?.touch||target?.tagName};
  });
  console.log('MOBILE HIT TARGETS '+JSON.stringify(rects));
  for(const id of ['fire','reload','jump','interact','switch','fly','descend','scope']){
   const b=rects.r[id];
   assert.ok(b.width>=44&&b.height>=44,'mobile '+id+' touch target is too small');
   assert.ok(!overlap(b,rects.r['ammo'])&&!overlap(b,rects.r['pause-button']),
     id+' overlaps ammo/pause HUD');
  }
  assert.equal(rects.pauseClickTarget,'pause-button','look zone blocks mobile pause button');
  assert.ok(!overlap(rects.r['move-pad'],rects.r['health']),
    'movement pad overlaps health HUD');
  const phoneShot=await mobile.screenshot({timeout:90000,path:'hissrum-strike-mobile.png'});
  const mobileMetrics=imageMetrics(phoneShot);console.log('MOBILE IMAGE METRICS '+JSON.stringify(mobileMetrics));
  assert.ok(mobileMetrics.mean>23,'phone gameplay still black/unrecognizable');
  assert.ok(mobileMetrics.std>10,'phone gameplay lacks visible geometry');
  assert.equal(await mobile.locator('#flight-toggle').getAttribute('aria-pressed'),'true');
  await mobile.locator('#flight-toggle').tap();
  await mobile.waitForFunction(()=>!window.__hissrumDiagnostics().flying,null,{timeout:3000});
  console.log('PASS: portrait touch flight/descend and Scope 5 optical zoom');
  await mobile.locator('#pause-button').tap();
  await mobile.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await mobile.locator('#resume').tap();
  await mobile.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});

  let aim=await mobile.evaluate(()=>window.__hissrumVisualTest.prepareAutoFire('sniper'));
  assert.ok(aim);
  await mobile.waitForTimeout(500);
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).magazine,5);
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#auto-fire-pause').selectOption('auto');
  await mobile.locator('#resume').tap();
  aim=await mobile.evaluate(()=>window.__hissrumVisualTest.prepareAutoFire('sniper'));
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),false);
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().magazine<5,null,{timeout:45000});
  const fired=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(fired.playerShotAt-aim.since>=.32-1/60,'sniper must complete dwell before first auto shot');
  assert.ok(fired.recoil?.serial>=1,'auto shot must drive real recoil');
  assert.equal(fired.effectiveAimPitch,fired.rawAimPitch+fired.recoil.pitch);
  console.log('PASS: Actual visible-enemy mobile sniper auto-fire, dwell and shared camera/ballistic recoil');
  await mobile.locator('#shop-button').tap();
  const mobileCredits=(await mobile.evaluate(()=>window.__hissrumDiagnostics())).money;
  await mobile.locator('[data-buy="smg"]').tap();
  const mobilePurchase=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(mobilePurchase.money,mobileCredits-1250);
  assert.equal(mobilePurchase.equippedWeapon,'smg');
  await mobile.locator('#shop-close').tap();
  await mobile.locator('#grenade-toggle').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().trajectoryPoints>5,null,{timeout:30000});
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),true,'grenades require manual throw');
  assert.equal(await mobile.locator('[data-touch="fire"]').textContent(),'KASTA');
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).grenadeSpeed,17);
  console.log('PASS: Mobile paid arsenal, deliberate grenade control and real-GLB ballistic preview');
  // Readability controls are deliberately kept out of the mobile aiming area.
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
  // Hold an actual touch until Game registers a shot. A tap can start
  // and end between software-WebGL frames without ever being sampled.
  const fireBounds=await mobile.locator('[data-touch="fire"]').boundingBox();
  assert.ok(fireBounds);
  const heldTouch=await phone.newCDPSession(mobile);
  await heldTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{
    x:fireBounds.x+fireBounds.width/2,y:fireBounds.y+fireBounds.height/2,id:7
  }]});
  try{
    await mobile.waitForFunction(()=>window.__hissrumDiagnostics().magazine<30,null,{timeout:45000});
  }finally{
    await heldTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await heldTouch.detach();
  }
  await mobile.locator('[data-touch="reload"]').tap();
  await mobile.waitForFunction(()=>!document.getElementById('reload-meter').hidden,null,{timeout:15000});
  assert.ok(Number(await mobile.locator('#reload-meter').getAttribute('aria-valuenow'))>=0);
  await mobile.evaluate(()=>window.__hissrumVisualTest.previewCombatFeedback());
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-combat-feedback.png'});
  console.log('PASS: Mobile scoreboard toggle, readable reload progress, persistent ally/feedback preferences and no extra aiming buttons');
  await runInputHudPolishChecks(mobile,phone);
  // Cartridge tank: original GLB pad, actual touch controls and real Game damage.
  assert.ok(await mobile.evaluate(()=>window.__hissrumVisualTest.prepareTank()));
  await mobile.waitForFunction(()=>document.querySelector('[data-touch="interact"]').textContent==='KÖR',null,{timeout:15000});
  await mobile.locator('[data-touch="interact"]').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().tank?.driving,null,{timeout:15000});
  const tankBefore=await mobile.evaluate(()=>window.__hissrumDiagnostics().tank);
  assert.equal(tankBefore.hp,900);assert.equal(tankBefore.visible,true);
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),true,'tank cannon stays manual');
  assert.equal(await mobile.locator('[data-touch="fire"]').textContent(),'KANON');
  const tankTouch=await phone.newCDPSession(mobile);
  const pad=await mobile.locator('#move-pad').boundingBox();
  await tankTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+8,id:8}]});
  try{
    await mobile.waitForFunction(start=>{const t=window.__hissrumDiagnostics().tank;return Math.hypot(t.x-start.x,t.z-start.z)>.35;},tankBefore,{timeout:30000});
  }finally{await tankTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  const cannon=await mobile.locator('[data-touch="fire"]').boundingBox();
  await tankTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cannon.x+24,y:cannon.y+25,id:9}]});
  try{await mobile.waitForFunction(()=>Number.isFinite(window.__hissrumDiagnostics().tank.lastShot),null,{timeout:30000});}
  finally{await tankTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tankTouch.detach();}
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-cartridge-tank-mobile.png'});
  assert.equal(await mobile.evaluate(()=>window.__hissrumVisualTest.damageTank(80)),true);
  assert.ok((await mobile.evaluate(()=>window.__hissrumDiagnostics().tank)).hp<900);
  // First leave through real UI, preserving on-foot weapons, then re-enter.
  await mobile.locator('[data-touch="interact"]').tap();
  await mobile.waitForFunction(()=>!window.__hissrumDiagnostics().tank.driving,null,{timeout:15000});
  await mobile.locator('[data-touch="interact"]').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().tank.driving,null,{timeout:15000});
  await mobile.evaluate(()=>window.__hissrumVisualTest.damageTank(5000));
  await mobile.waitForFunction(()=>!window.__hissrumDiagnostics().tank.alive&&window.__hissrumDiagnostics().playerDeathCamera,null,{timeout:15000});
  await mobile.screenshot({timeout:90000,path:'hissrum-strike-cartridge-wreck.png'});
  assert.equal(await mobile.evaluate(()=>window.__hissrumVisualTest.advanceVehicleRespawn()),2);
  const reborn=await mobile.evaluate(()=>window.__hissrumDiagnostics().tank);
  assert.equal(reborn.hp,900);assert.equal(reborn.alive,true);assert.equal(reborn.driverId,null);
  assert.deepEqual({x:reborn.x,y:reborn.y,z:reborn.z,yaw:reborn.yaw},reborn.home);
  console.log('PASS: Real GLB Cartridge tank, manual mobile cannon, drive/exit, armor destruction, driver Death01 and fixed-pad auto-respawn');
  assert.deepEqual(issues,[],'Unexpected browser errors/network failures');
  console.log('PASS: Real Hissrum V5 GLB, CC0 sound decoding, blood splashes, eight dwarfs, autonomous flying bots, iPhone volume and flight controls, pause/resume');
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
})().catch(e=>{console.error('BROWSER VISUAL REGRESSION: '+e.stack);process.exitCode=1;});
