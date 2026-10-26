/* Browser-level smoke against the original Hissrum12 V5 GLB. Runs in GitHub Actions. */
const { chromium }=require('playwright');
const {spawn}=require('node:child_process');
const {setTimeout: sleep}=require('node:timers/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const http=require('node:http');
const {PNG}=require('pngjs');

const root=path.resolve(__dirname,'../../..'),port=8932;
const base='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'pipe'});
function checkServer(){
 return new Promise(resolve=>{
  http.get(base,res=>{res.resume();resolve(res.statusCode<500);}).on('error',()=>resolve(false));
 });
}
async function ready(){for(let i=0;i<40;i++){if(await checkServer())return;await sleep(250);}throw Error('Local server did not start');}
(async()=>{
 const failures=[],log=[];
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',err=>{failures.push(err.message);console.error('[CHROME EXCEPTION] '+err.stack);});
  page.on('console',msg=>{
   console.log('[CHROME '+msg.type()+'] '+msg.text());if(msg.type()==='error')log.push('console: '+msg.text());
  });
  page.on('requestfailed',req=>{const m='failed fetch '+req.url()+' '+(req.failure()?.errorText||'');log.push(m);console.error('[CHROME NET] '+m);});
  await page.goto(base+'games/hissrum-strike/?test=1',{waitUntil:'domcontentloaded',timeout:45000});
  console.log('[SMOKE] Waiting for live GLB scene startup (45s)...');
  await page.waitForFunction(()=>{
   const ready=document.getElementById('start');
   const err=document.getElementById('loading');
   return !ready.disabled||err.classList.contains('failed');
  },null,{timeout:45000});
  const isFailed=await page.locator('#loading').evaluate(node=>node.classList.contains('failed'));
  const message=await page.locator('#loading-text').textContent();
  assert.equal(isFailed,false,'model/scene init failed: '+message+'; logs: '+log.join('\n'));
  assert.equal(await page.locator('#start').isEnabled(),true);
  await page.locator('#start').click();
  await page.waitForSelector('#hud:not([hidden])',{timeout:10000});
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('#menu').isVisible(),false);
  assert.ok(Number(await page.locator('#health').textContent())>=0,'game health should render');
  assert.ok(await page.locator('#weapon').textContent(),'game weapon should render');
  const inspect=await page.evaluate(()=>window.__hissrumInspect?.());
  console.log('[DESKTOP_GEOMETRY] '+JSON.stringify(inspect));
  assert.equal(inspect.floorReferenceY,0,'source floor must be y=0, not at bottom of plinth');
  assert.ok(inspect.modelBounds.min[1]<0,'GLB plinth remains below original floor');
  assert.ok(inspect.modelBounds.min[2]<inspect.roomBounds.min[2]-5,
    'the playable map must ignore GLB assets located beyond the actual room footprint');
  assert.ok(inspect.player.x>inspect.roomBounds.min[0]&&inspect.player.x<inspect.roomBounds.max[0]
     &&inspect.player.z>inspect.roomBounds.min[2]&&inspect.player.z<inspect.roomBounds.max[2],
    'player must spawn inside actual source floor');
  assert.ok(Math.abs(inspect.camera.yaw-inspect.anchor.yaw)<.4&&Math.abs(inspect.camera.pitch-.085)<.4,
    'pointer lock must not warp the initial player camera toward the ceiling');
  assert.ok(inspect.camera.position[1]>1.05 && inspect.camera.position[1]<2.3,
    'player camera must be above the real floor at miniature eye height');
  assert.ok(inspect.objects>=80,'all original model pieces should render');
  const desktopShot=await page.screenshot({path:'hissrum-strike-browser.png'});
  function visibleRoomPixels(data,label){
    const png=PNG.sync.read(data);
    let count=0,sum=0,sumSq=0,bright=0,tones=new Set();
    // Exclude screen edges, top scoreboard, bottom HUD and minimap.
    for(let y=Math.floor(png.height*.25);y<png.height*.69;y+=3)
      for(let x=Math.floor(png.width*.24);x<png.width*.76;x+=3){
        const i=(y*png.width+x)*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2];
        const lum=r*.2126+g*.7152+b*.0722;
        count++;sum+=lum;sumSq+=lum*lum;if(lum>46)bright++;
        tones.add((r>>5)*64+(g>>5)*8+(b>>5));
      }
    const mean=sum/count,contrast=Math.sqrt(Math.max(0,sumSq/count-mean*mean)),lit=bright/count;
    console.log('[SCENE_PIXELS] '+JSON.stringify({label,width:png.width,height:png.height,mean:+mean.toFixed(2),contrast:+contrast.toFixed(2),lit:+lit.toFixed(3),tones:tones.size}));
    assert.ok(mean>15 && contrast>8 && tones.size>10,
      label+' is flat/dark/featureless: camera may be under the real floor');
  }
  visibleRoomPixels(desktopShot,'desktop');
  // FPS pointer lock redirects mouse clicks. Escape is the real desktop pause key.
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});
  // Real iPhone-portrait-sized Chromium test: the user reported a broken
  // view, tiny horizon bots and enormous controls specifically on mobile.
  const mobile=await browser.newContext({
    viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true
  });
  const phone=await mobile.newPage();
  phone.on('pageerror',err=>failures.push('[mobile] '+err.stack));
  await phone.goto(base+'games/hissrum-strike/?test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await phone.waitForFunction(()=>!document.getElementById('start').disabled||
    document.getElementById('loading').classList.contains('failed'),null,{timeout:60000});
  assert.ok(!await phone.locator('#loading').evaluate(e=>e.classList.contains('failed')),
    'mobile model load must succeed');
  await phone.locator('#start').tap();
  await phone.waitForSelector('#hud:not([hidden])');
  await phone.waitForTimeout(1200);
  const mobileInspect=await phone.evaluate(()=>window.__hissrumInspect?.());
  console.log('[MOBILE_GEOMETRY] '+JSON.stringify(mobileInspect));
  assert.ok(mobileInspect.roomBounds.max[2]-mobileInspect.roomBounds.min[2]<80,
    'mobile minimap should fit the physical room, not out-of-room decorations');
  assert.ok(mobileInspect.camera.position[1]>1.05&&mobileInspect.camera.position[1]<2.3,
    'mobile camera must stand above the real floor');
  const controls=await phone.evaluate(()=>({
    pad:document.getElementById('move-pad').getBoundingClientRect().toJSON(),
    fire:document.querySelector('[data-touch="fire"]').getBoundingClientRect().toJSON(),
    hud:document.querySelector('.hud-top').getBoundingClientRect().toJSON()
  }));
  console.log('[MOBILE_LAYOUT] '+JSON.stringify(controls));
  assert.ok(controls.pad.width<=104 && controls.fire.width<=52,
    'touch controls must not obscure most of the phone screen');
  const mobileShot=await phone.screenshot({path:'hissrum-strike-mobile.png'});
  visibleRoomPixels(mobileShot,'mobile');
  await phone.locator('#pause-button').tap({timeout:5000});
  await phone.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await phone.locator('#resume').tap();
  await phone.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});
  if(process.env.VISUAL_DEBUG==='1')console.log('[MOBILE_JPEG_BASE64] '+(
    await phone.screenshot({type:'jpeg',quality:49,scale:'css'})
  ).toString('base64'));
  await mobile.close();

  console.log('PASS: original GLB, camera above floor, visible geometry, desktop/mobile UI, pause/resume');
  console.log('Scene initialization status: '+message);
  if(log.length)console.log('Browser diagnostics:\n'+log.join('\n'));
  assert.equal(failures.length,0,'browser errors: '+failures.join('\n'));
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
})().catch(err=>{console.error('BROWSER SMOKE FAILED: '+err.stack);process.exitCode=1;});
