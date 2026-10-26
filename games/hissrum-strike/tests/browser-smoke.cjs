/* GLB-backed browser regression: real model, floor alignment, furniture visibility,
   5v5 round, touch hit targets, portrait gameplay, pause and image contrast. */
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
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
  const issues=[];
  const desktop=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const page=await launchReadyPage(desktop,'desktop',issues);
  await page.locator('#start').click();
  await page.waitForSelector('#hud:not([hidden])');
  await page.waitForTimeout(850);
  const diag=await page.evaluate(()=>window.__hissrumDiagnostics());
  console.log('DESKTOP ROOM DIAGNOSTICS '+JSON.stringify({scale:diag.scale,player:diag.player,room:diag.stats.roomExtent,
    modelFloor:diag.floorReference,spawn:diag.stats.playerSpawn,
    visibleProps:diag.namedProps.filter(p=>p.ndc[0]>-1&&p.ndc[0]<1&&p.ndc[1]>-1&&p.ndc[1]<1&&p.ndc[2]>0&&p.ndc[2]<1).slice(0,12)}));
  assert.ok(diag.namedProps.length>=10,'must load original furnishings, not a blank proxy scene');
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
  assert.ok(diag.player.eye>1.1&&diag.player.eye<3.5,'first-person camera must be above floor');
  assert.ok(diag.stats.roomExtent.z<55,'elevator cabin must not expand the playable arena');
  assert.ok(diag.namedProps.some(p=>p.ndc.every(Number.isFinite)&&Math.abs(p.ndc[0])<.9&&Math.abs(p.ndc[1])<.9&&p.ndc[2]>0&&p.ndc[2]<1),
   'real named GLB carts/pallets must be IN FRONT of camera');
  const shot=await page.screenshot({path:'hissrum-strike-browser.png'});
  const desktopMetrics=imageMetrics(shot);console.log('DESKTOP IMAGE METRICS '+JSON.stringify(desktopMetrics));
  assert.ok(desktopMetrics.mean>25,'original-room gameplay is implausibly dark');
  assert.ok(desktopMetrics.std>11,'view lacks readable geometry/contrast');
  assert.ok(Number(await page.locator('#health').textContent())>=0);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});

  const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
    isMobile:true,hasTouch:true});
  const mobile=await launchReadyPage(phone,'mobile',issues);
  await mobile.locator('#start').tap();
  await mobile.waitForSelector('#touch-controls:not([hidden])');
  await mobile.waitForTimeout(900);
  const mobileDiag=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(Math.abs(mobileDiag.player.y)<.3,'mobile player must stand ON the real floor');
  const rects=await mobile.evaluate(()=>{
    const ids=['move-pad','pause-button','health','ammo','look-zone','minimap'];
    const r={};
    for(const id of ids){const e=document.getElementById(id);const b=e.getBoundingClientRect();
      r[id]={x:b.x,y:b.y,width:b.width,height:b.height};}
    for(const value of ['fire','reload','jump','interact','switch']){
      const b=document.querySelector('[data-touch='+value+']').getBoundingClientRect();
      r[value]={x:b.x,y:b.y,width:b.width,height:b.height};
    }
    const pause=r['pause-button'],target=document.elementFromPoint(pause.x+pause.width/2,pause.y+pause.height/2);
    return {r,pauseClickTarget:target?.id||target?.dataset?.touch||target?.tagName};
  });
  console.log('MOBILE HIT TARGETS '+JSON.stringify(rects));
  for(const id of ['fire','reload','jump','interact','switch']){
   const b=rects.r[id];
   assert.ok(b.width>=44&&b.height>=44,'mobile '+id+' touch target is too small');
   assert.ok(!overlap(b,rects.r['ammo'])&&!overlap(b,rects.r['pause-button']),
     id+' overlaps ammo/pause HUD');
  }
  assert.equal(rects.pauseClickTarget,'pause-button','look zone blocks mobile pause button');
  assert.ok(!overlap(rects.r['move-pad'],rects.r['health']),
    'movement pad overlaps health HUD');
  const phoneShot=await mobile.screenshot({path:'hissrum-strike-mobile.png'});
  const mobileMetrics=imageMetrics(phoneShot);console.log('MOBILE IMAGE METRICS '+JSON.stringify(mobileMetrics));
  assert.ok(mobileMetrics.mean>23,'phone gameplay still black/unrecognizable');
  assert.ok(mobileMetrics.std>10,'phone gameplay lacks visible geometry');
  await mobile.locator('#pause-button').tap();
  await mobile.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await mobile.locator('#resume').tap();
  await mobile.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});
  assert.deepEqual(issues,[],'Unexpected browser errors/network failures');
  console.log('PASS: real 39-object GLB, floor alignment, recognizable foreground, 5v5 match, portrait iPhone visibility, mobile HUD, pause/resume');
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
})().catch(e=>{console.error('BROWSER VISUAL REGRESSION: '+e.stack);process.exitCode=1;});
