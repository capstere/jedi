/* V5.0.1 focused regression: exercise the actual built UI and simulation together.
 * Default: file://. SMOKE_LOAD_MODE=inline is a documented test-only fallback
 * for environments that prohibit file URLs. It does NOT verify file navigation
 * or persistent localStorage. No application functions are mocked/replaced.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const project=path.resolve(__dirname,'..'),html=path.join(project,'STARTA_HISSRUM_12_V5.html');
const output=process.env.SMOKE_OUTPUT||path.join(__dirname,'artifacts-import');
fs.mkdirSync(output,{recursive:true});
const inline=process.env.SMOKE_LOAD_MODE==='inline',headless=process.env.SMOKE_HEADLESS!=='0';
const report={startedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),loadMode:inline?'inline-built-html':'file://',headless,networkDisabled:true,results:[],pageErrors:[],consoleErrors:[],networkRequests:[],limitations:inline?['file:// navigation is blocked by the test environment; the complete unchanged built HTML is loaded inline.','Persistent localStorage is not verified by this fallback.']:[]};
let browser,context,page;
function write(){fs.writeFileSync(path.join(output,'import-regression-report.json'),JSON.stringify(report,null,2)+'\n');}
async function reset(){await page.evaluate(()=>{
 const h=HISSRUM,s=h.simulation;s.pause();s.reset();for(const p of s.people.slice())s.remove(p.id);
 s.setChaos(false);s.setSpeed(1);s.setNoGoZones([]);s.maxPeople=12;h.simUI.cancel();h.simUI.stopFollow();h.simUI.select(null);
 h.planner.restore(LayoutCore.createLayout({name:'Before import'}),true);h.door.setAngle(0,false);h.door.setDirection(1);
 h.elevator.restore({floor:3,lights:true});h.setView('plan');
 const select=document.getElementById('simQuality');select.value='auto';select.dispatchEvent(new Event('change'));h.simUI.refresh(true);
});}
async function scenario(name,fn){const entry={name},start=Date.now();try{await reset();entry.details=await fn();entry.status='passed';}catch(e){entry.status='failed';entry.error=e.stack||String(e);}entry.elapsedMs=Date.now()-start;report.results.push(entry);console.log(name+': '+entry.status+(entry.error?' — '+entry.error.split('\n')[0]:''));write();}
(async()=>{
 const args=['--enable-unsafe-swiftshader'];if(process.env.SMOKE_SOFTWARE_GL==='1')args.push('--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage');
 browser=await playwright.chromium.launch({headless,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args});report.browser=await browser.version();
 context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});await context.setOffline(true);page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.networkRequests.push(r.url());});
 if(inline)await page.setContent(fs.readFileSync(html,'utf8'));else await page.goto(pathToFileURL(html).href);
 await page.waitForFunction(()=>window.APP_READY===true,null,{timeout:30000});
 // Test fixture: only the doorway strip remains permitted. A closed leaf has
 // no valid alternative within the existing 1.5 m import-placement tolerance.
 await page.evaluate(()=>{window.importFixture=(angle,direction=1)=>({
  format:'hissrum12-v5-scenario',version:1,
  layout:LayoutCore.createLayout({name:'Doorway fixture',door:{angle,direction},keepClear:[
   {id:'south-no-go',name:'South test exclusion',x:0,z:.185,w:9,d:6.91,rot:0,clearance:0},
   {id:'north-no-go',name:'North test exclusion',x:0,z:-5.965,w:9,d:3.37,rot:0,clearance:0}
  ]}),
  simulation:{format:'hissrum12-v5-simulation',version:1,speed:1,chaos:false,maxPeople:12,noGoZoneIds:['south-no-go','north-no-go'],people:[{name:'Doorway person',appearance:'colleague-a',height:1.72,mode:'stationary',paused:false,x:1.65,z:-3.8,yaw:0}]},
  elevator:{version:1,floor:5,lights:true,sound:false},display:{quality:'auto'}
 });});
 await scenario('incoming_open_door_overrides_current_closed_in_preflight',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM,j=importFixture(90);h.simUI.importScenario(j);const p=h.simulation.people[0];return {door:h.door.degrees,direction:h.door.direction,people:h.simulation.people.length,point:[p.x,p.z],running:h.simulation.running,free:h.simulation.isFree(p.x,p.z)};});
  assert.equal(r.door,90);assert.equal(r.people,1);assert.deepEqual(r.point,[1.65,-3.8]);assert.equal(r.running,false);assert(r.free);return r;
 });
 await scenario('invalid_closed_door_scenario_rejected_before_layout_changes',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM;h.door.setAngle(90,false);h.simulation.add({x:0,z:0,name:'Keep me'});h.simulation.start();const before=JSON.stringify(h.planner.snapshot()),people=JSON.stringify(h.simulation.exportConfig());let error='';try{h.simUI.importScenario(importFixture(0));}catch(e){error=e.message;}return {error,layoutUnchanged:before===JSON.stringify(h.planner.snapshot()),peopleUnchanged:people===JSON.stringify(h.simulation.exportConfig()),running:h.simulation.running,door:h.door.degrees};});
  assert(r.error);assert(r.layoutUnchanged,'Rejected import must not replace furniture or the door');assert(r.peopleUnchanged);assert(r.running);assert.equal(r.door,90);return r;
 });
 await scenario('saved_quality_restores_runtime_control_and_reexport',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM,results=[];for(const q of ['low','high','auto']){const j=h.simUI.exportScenario(true);j.display.quality=q;h.simUI.importScenario(j);results.push({requested:q,runtime:h.simUI.quality,control:document.getElementById('simQuality').value,saved:h.simUI.exportScenario().display.quality});}return results;});
  for(const r0 of r)for(const key of ['runtime','control','saved'])assert.equal(r0[key],r0.requested);return r;
 });
 await scenario('invalid_quality_rejected_without_mutating_layout_people_or_view',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM;h.simulation.add({x:0,z:0,name:'Original'});const j=h.simUI.exportScenario(true);j.layout.name='Must not replace';j.display.quality='ultra-unknown';const before=JSON.stringify(h.planner.snapshot()),people=JSON.stringify(h.simulation.exportConfig());let error='';try{h.simUI.importScenario(j);}catch(e){error=e.message;}return {error,unchanged:before===JSON.stringify(h.planner.snapshot())&&people===JSON.stringify(h.simulation.exportConfig()),quality:h.simUI.quality};});
  assert(r.error);assert(r.unchanged);assert.equal(r.quality,'auto');return r;
 });
 await scenario('legacy_missing_display_and_bare_simulation_preserve_quality',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM,el=document.getElementById('simQuality');el.value='high';el.dispatchEvent(new Event('change'));h.simulation.add({x:0,z:0});const j=h.simUI.exportScenario(false);delete j.display;h.simUI.importScenario(j);const a=h.simUI.quality;h.simUI.importScenario(h.simulation.exportConfig());return {scenario:a,bare:h.simUI.quality,control:el.value,people:h.simulation.people.length,running:h.simulation.running};});
  assert.equal(r.scenario,'high');assert.equal(r.bare,'high');assert.equal(r.control,'high');assert.equal(r.people,1);assert(!r.running);return r;
 });
 await scenario('both_door_directions_and_saved_target_during_animation',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM,out=[];for(const dir of [1,-1]){h.planner.restore(LayoutCore.createLayout(),true);h.door.setAngle(90,true);const j=importFixture(90,dir);h.simUI.importScenario(j);out.push({direction:h.door.direction,angle:h.door.degrees,point:h.simulation.people.map(p=>[p.x,p.z])});}return out;});
  assert.deepEqual(r.map(v=>v.direction),[1,-1]);for(const v of r){assert.equal(v.angle,90);assert.deepEqual(v.point,[[1.65,-3.8]]);}return r;
 });
 await scenario('scenario_without_layout_uses_current_not_target_door_pose',async()=>{
  const r=await page.evaluate(()=>{const h=HISSRUM,j=importFixture(90);h.planner.restore(j.layout,true);h.door.setAngle(0,false);h.door.setAngle(90,true);delete j.layout;const before=JSON.stringify(h.planner.snapshot());let error='';try{h.simUI.importScenario(j);}catch(e){error=e.message;}return{error,unchanged:before===JSON.stringify(h.planner.snapshot()),people:h.simulation.people.length};});
  assert(r.error);assert(r.unchanged);assert.equal(r.people,0);return r;
 });
 await scenario('three_supplied_scenarios_import_and_remain_separate_from_layout',async()=>{
  const rows=[];for(const f of ['V5_01_Liv_i_5S_rummet.json','V5_02_MH_upphamtning.json','V5_03_Kaizen_Chaos.json']){
   const data=JSON.parse(fs.readFileSync(path.join(project,'examples',f),'utf8'));
   const r=await page.evaluate(j=>{const h=HISSRUM;h.simUI.importScenario(j);const before=JSON.stringify(h.planner.snapshot()),count=h.simulation.people.length,paused=!h.simulation.running;h.simulation.start();for(let i=0;i<30;i++)h.simulation.tick(1/30);h.simulation.pause();h.render();return{count,paused,layoutUnchanged:before===JSON.stringify(h.planner.snapshot()),quality:h.simUI.quality,glError:h.gl.getError()};},data);
   assert.equal(r.count,data.simulation.people.length);assert(r.paused&&r.layoutUnchanged);assert.equal(r.glError,0);rows.push({file:f,...r});
  }return rows;
 });
 await scenario('real_scenario_file_input_restores_low_quality',async()=>{
  const data=await page.evaluate(()=>{const j=HISSRUM.simUI.exportScenario(true);j.display.quality='low';return j;});
  await page.locator('#simFile').setInputFiles({name:'low-detail.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>HISSRUM.simUI.quality==='low');assert.equal(await page.locator('#simQuality').inputValue(),'low');
  const r=await page.evaluate(()=>({quality:HISSRUM.simUI.quality,paused:!HISSRUM.simulation.running,glError:HISSRUM.gl.getError()}));assert(r.paused);assert.equal(r.glError,0);return r;
 });
 await scenario('AB_comparison_camera_and_floor_measurement',async()=>{
  await page.evaluate(()=>{const h=HISSRUM;h.planner.restore(LayoutCore.createLayout({objects:[{id:'A-pallet',type:'pallet',name:'Pall A',x:-1,z:1,y:.006,w:1.2,d:.8,h:.144,rot:0,locked:false}]}),true);h.setView('plan');});
  await page.locator('[data-panel="layouts"]').click();await page.locator('#captureA').click();
  await page.evaluate(()=>{const h=HISSRUM,j=h.planner.snapshot();j.objects.push({...j.objects[0],id:'B-pallet',name:'Pall B',x:1});h.planner.restore(j,true);});
  await page.locator('#captureB').click();const camera=await page.evaluate(()=>JSON.stringify([HISSRUM.state.eye,HISSRUM.state.target,HISSRUM.state.span]));
  await page.locator('#showA').click();assert.equal(await page.evaluate(()=>HISSRUM.planner.objects.length),1);
  await page.locator('#showB').click();assert.equal(await page.evaluate(()=>HISSRUM.planner.objects.length),2);
  assert.equal(await page.evaluate(()=>JSON.stringify([HISSRUM.state.eye,HISSRUM.state.target,HISSRUM.state.span])),camera);
  await page.locator('[data-panel="room"]').click();await page.locator('[data-tool="measure"]').click();
  for(const x of [-1,1]){const q=await page.evaluate(x=>{HISSRUM.render();const p=HISSRUM.project([x,.028,0]),r=document.getElementById('viewport').getBoundingClientRect();return [p[0]+r.left,p[1]+r.top];},x);await page.mouse.click(...q);}
  const r=await page.evaluate(()=>{const m=HISSRUM.planner.snapshot().measures.at(-1);return{length:m?Math.hypot(m.b[0]-m.a[0],m.b[2]-m.a[2]):null,glError:HISSRUM.gl.getError()};});
  assert(r.length!==null&&Math.abs(r.length-2)<.03);assert.equal(r.glError,0);return{ABCounts:[1,2],sameCamera:true,...r};
 });
 await scenario('photo_mode_real_PNG_export_and_resume',async()=>{
  const data=JSON.parse(fs.readFileSync(path.join(project,'examples','V5_01_Liv_i_5S_rummet.json'),'utf8'));
  await page.evaluate(j=>{const h=HISSRUM;h.simUI.importScenario(j);h.door.setAngle(90,false);h.setView('overview');h.simulation.start();for(let i=0;i<90;i++)h.simulation.tick(1/30);h.render();},data);
  await page.locator('[data-panel="simulation"]').click();await page.locator('#photoMode').click();assert.equal(await page.evaluate(()=>HISSRUM.simulation.running),false);
  const [image]=await Promise.all([page.waitForEvent('download'),page.locator('#photoSavePNG').click()]);const dest=path.join(output,'V5_0_1_Verifierad_oversikt.png');await image.saveAs(dest);
  assert(fs.readFileSync(dest).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  await page.locator('#exitPhoto').click();assert.equal(await page.evaluate(()=>HISSRUM.simulation.running),true);
  await page.evaluate(()=>{HISSRUM.simulation.pause();HISSRUM.simUI.refresh(true);});
  return{photoPauses:true,PNGExport:true,resumeOnExit:true,people:data.simulation.people.length};
 });
 assert.equal(report.networkRequests.length,0);assert.equal(report.pageErrors.length,0);assert.equal(report.consoleErrors.length,0);
 report.status=report.results.some(r=>r.status==='failed')?'failed':'passed';report.finishedAt=new Date().toISOString();write();await browser.close();if(report.status==='failed')process.exitCode=1;
})().catch(async e=>{report.fatal=e.stack||String(e);report.status='failed';write();console.error(e);process.exitCode=1;if(browser)await browser.close();});
