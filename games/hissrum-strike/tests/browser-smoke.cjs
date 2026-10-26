/* Browser-level smoke against the original Hissrum12 V5 GLB. Runs in GitHub Actions. */
const { chromium }=require('playwright');
const {spawn}=require('node:child_process');
const {setTimeout: sleep}=require('node:timers/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const http=require('node:http');

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
  await page.goto(base+'games/hissrum-strike/',{waitUntil:'domcontentloaded',timeout:45000});
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
  await page.screenshot({path:'hissrum-strike-browser.png'});
  // FPS pointer lock redirects mouse clicks. Escape is the real desktop pause key.
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause:not([hidden])',{timeout:5000});
  await page.locator('#resume').click();
  await page.waitForFunction(()=>document.querySelector('#pause').hidden,null,{timeout:5000});
  console.log('PASS: GLB initialization, start, HUD, renders, pause/resume, screenshot');
  console.log('Scene initialization status: '+message);
  if(log.length)console.log('Browser diagnostics:\n'+log.join('\n'));
  assert.equal(failures.length,0,'browser errors: '+failures.join('\n'));
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
})().catch(err=>{console.error('BROWSER SMOKE FAILED: '+err.stack);process.exitCode=1;});
