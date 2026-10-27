/* Focused, fast Three.js allocation/lifecycle regression alongside the full GLB smoke. */
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
(async()=>{
 const index=await readFile(path.join(root,'games/hissrum-strike/index.html'),'utf8');
 const map=index.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
 if(!map)throw new Error('Game import map missing');
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(pathname==='/fixture'){
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><script type="importmap">'+map+'</script>');return;
   }
   const file=path.resolve(root,'.'+pathname);
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   res.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'text/javascript':'application/octet-stream');
   res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  const result=await page.evaluate(async()=>{
   const {runGrenadeViewChecks}=await import('/games/hissrum-strike/tests/grenade-view-browser-checks.mjs');
   return runGrenadeViewChecks();
  });
  console.log('PASS: real Three.js grenade buffer, tank-guide guard and bounded mesh reuse',JSON.stringify(result));
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
