/* Optional isolated WebGL smoke. PLAYWRIGHT_MODULE and CHROME_PATH select local tools. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1200,height:900}});await context.setOffline(true);
  const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.join(__dirname,'npc-renderer-smoke.html')).href);await page.waitForFunction(()=>window.test);
  const report=await page.evaluate(()=>{
   const {gl,r,people,vp,eye}=test,full=r.diagnostics(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let coloredPixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180||pixels[i+1]<180||pixels[i+2]<180)coloredPixels++;
   r.draw(people,{vp,eye,quality:'low'});const low=r.diagnostics();
   const visible=people.map(p=>({...p,x:p.x+100}));r.draw(visible,{vp,eye});const culled=r.diagnostics();
   const before=r.samplePose(people[1].appearance,'walk',0),after=r.samplePose(people[1].appearance,'walk',.17);
   const maxJointMotion=Math.max(...before.map((v,i)=>Math.abs(v-after[i])));
   const many=Array.from({length:12},(_,i)=>({...people[i%4],id:'perf-'+i,x:(i%4-1.5)*1.1,z:Math.floor(i/4)-1}));
   const start=performance.now();for(let frame=0;frame<90;frame++){many.forEach((p,i)=>{p.phase=frame/30+i*.19;p.state='walk';});r.draw(many,{vp,eye,quality:'auto'});}gl.finish();const batchMs=performance.now()-start;
   const performanceStats=r.diagnostics();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);r.draw(people,{vp,eye,quality:'high'});
   return{fileProtocol:location.protocol,full,low,culled,maxJointMotion,coloredPixels,performance12:{frames:90,totalMs:batchMs,msPerFrame:batchMs/90,measurement:'Synchronous animation and WebGL command submission batch, not presentation FPS or GPU timing.',stats:performanceStats},glError:gl.getError()};
  });
  assert.equal(report.glError,0);assert.equal(report.fileProtocol,'file:');assert.equal(report.full.drawn,4);
  assert(report.coloredPixels>5000);assert(report.maxJointMotion>.1);assert(report.low.triangles<report.full.triangles);
  assert.equal(report.culled.culled,4);assert.equal(report.culled.drawn,0);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const output=process.env.SMOKE_OUTPUT||path.join(__dirname,'artifacts');fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'npc-assets-preview.png')});fs.writeFileSync(path.join(output,'npc-assets-report.json'),JSON.stringify({...report,errors,network,browser:await browser.version()},null,2)+'\n');
  console.log('PASS: offline skinning, visible pixels, animated joints, genuine LOD, frustum culling, 12-person batch. '+report.performance12.msPerFrame.toFixed(2)+' ms submission/frame (isolated batch; not presentation FPS or GPU timing).');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
