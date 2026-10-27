/* Focused native Web Audio regression; no CDN, GLB or synthetic AudioContext. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const html=`<!doctype html><meta charset="utf-8"><title>Hissrum audio regression</title><button id="run">Start audio check</button><script type="module">
import {runAudioWorkChecks} from '/games/hissrum-strike/tests/audio-work-browser-checks.mjs';
document.getElementById('run').onclick=()=>{window.audioDone=runAudioWorkChecks();window.audioDone.catch(()=>{});};window.audioReady=true;
</script>`;
const mime={'.mjs':'text/javascript','.js':'text/javascript','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
   args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.audioReady===true);
  await page.click('#run');
  const result=await page.evaluate(()=>Promise.race([window.audioDone,new Promise((_,reject)=>setTimeout(()=>reject(Error('Native audio check timed out')),30000))]));
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS native Hissrum audio work budget '+JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
