/* Simulation interaction stays outside the furniture planner and its autosave/history. */
function createSimulationUI(api){
 'use strict';
 const {$,gl,U,state,host,ctx,project,rayAt,invalidate,toast,download,planner,elevator,door,simulation:sim,renderer}=api,C=LayoutCore;
 let selectedId=null,placing=null,ghost=null,drag=null,followId=null,uiClock=0,photo=false,photoWasRunning=false,quality='auto',lastPeopleSignature='',lastDestinationSignature='',adaptiveLow=false,frameAverage=0;
 const variants=renderer.variants,byVariant=new Map(variants.map(v=>[v.id,v]));
 const selected=()=>sim.people.find(p=>p.id===selectedId);
 const element=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
 const on=(id,fn)=>{if($(id))$(id).onclick=fn;};
 function panel(){document.querySelector('[data-panel="simulation"]').click();}
 function select(id){selectedId=sim.people.some(p=>p.id===id)?id:null;if(selectedId){planner.select(null,{inspect:false});panel();}refresh(true);invalidate();}
 function cancel(){placing=null;ghost=null;if(drag){sim.update(drag.id,{paused:drag.paused});drag=null;}$('personPlacement').hidden=true;host.classList.remove('placing-person');invalidate();}
 function beginPlace(appearance){if(!byVariant.has(appearance))return;cancel();planner.cancelPlacement();planner.select(null,{inspect:false});api.clearTool();if(state.mode==='walk')api.setView('plan',false);placing=appearance;selectedId=null;panel();$('personPlacement').hidden=false;$('personPlacementText').textContent=byVariant.get(appearance).label+' · klicka på en fri golvyta';host.classList.add('placing-person');if(innerWidth<=850)document.body.classList.remove('panel-open');invalidate();}
 function floorAt(e){const r=host.getBoundingClientRect(),ray=rayAt(e.clientX-r.left,e.clientY-r.top);if(Math.abs(ray.dir[1])<.00001)return null;const t=-ray.origin[1]/ray.dir[1];if(t<=0)return null;const x=ray.origin[0]+ray.dir[0]*t,z=ray.origin[2]+ray.dir[2]*t;return{x,z};}
 function hit(e){const r=host.getBoundingClientRect(),ray=rayAt(e.clientX-r.left,e.clientY-r.top);let best=null,dist=Infinity;for(const p of sim.people){const obj={x:p.x,z:p.z,y:0,w:.56,d:.56,h:p.height,rot:0},t=C.rayHit(ray,obj);if(t!==null&&t<dist){best=p;dist=t;}}if(best&&state.mode!=='plan'){// A person behind furniture should not steal that furniture's click.
 for(const o of planner.showFurniture?planner.objects:[]){const t=C.rayHit(ray,o);if(t!==null&&t<dist-.04)return null;}}
 return best;}
 function handlePointer(kind,e){if(e.target.closest('button,input,select,textarea,.no-camera'))return false;
  if(kind==='cancel'){if(drag||placing){cancel();return true;}return false;}
  if(state.tool!=='view'||state.mode==='walk')return false;
  if(placing){const f=floorAt(e);if(f){ghost={id:'placement',appearance:placing,height:byVariant.get(placing).height,x:f.x,z:f.z,yaw:Math.PI,phase:.3,state:'idle'};}
   if(kind==='down'&&e.button===0&&f){if(!sim.isFree(f.x,f.z)){toast('Välj en fri golvyta.');return true;}const v=byVariant.get(placing),p=sim.add({appearance:placing,height:v.height,x:f.x,z:f.z,mode:placing==='material-handler'?'handler':'roam'});if(p){cancel();select(p.id);}}
   invalidate();return true;
  }
  if(kind==='down'){followId=null;const p=hit(e);if(p&&e.button===0){select(p.id);drag={id:p.id,paused:p.paused,startX:e.clientX,startY:e.clientY,moved:false};sim.update(p.id,{paused:true});host.setPointerCapture(e.pointerId);return true;}if(selectedId){selectedId=null;refresh(true);invalidate();}return false;}
  if(drag){if(kind==='move'&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5){const f=floorAt(e);if(f){sim.move(drag.id,f.x,f.z);drag.moved=true;invalidate();}}if(kind==='up'){sim.update(drag.id,{paused:drag.paused});drag=null;refresh(true);}return true;}
  return false;
 }
 function handleKey(e){if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return false;const k=e.key.toLowerCase(),p=selected();if(k==='escape'&&(placing||selectedId||photo||followId)){e.preventDefault();cancel();selectedId=null;followId=null;if(photo)togglePhoto(false);refresh(true);return true;}if(!p)return false;
  if(k==='delete'||k==='backspace'){e.preventDefault();sim.remove(p.id);selectedId=null;refresh(true);invalidate();return true;}
  if((e.ctrlKey||e.metaKey)&&k==='d'){e.preventDefault();const q=sim.duplicate(p.id);if(q)select(q.id);return true;}
  if(state.mode!=='walk'&&['arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();const step=e.shiftKey?.01:.1;sim.move(p.id,p.x+(k==='arrowleft'?-step:k==='arrowright'?step:0),p.z+(k==='arrowup'?-step:k==='arrowdown'?step:0));refresh(true);invalidate();return true;}return false;
 }
 function refresh(force=false){
  const p=selected(),stats=sim.getStats();$('simStatus').textContent=sim.running?'Simulation pågår':'Simulation pausad';$('simStatus').classList.toggle('running',sim.running);$('simCount').textContent=sim.people.length+' personer';$('simStart').disabled=sim.running||!sim.people.length;$('simPause').disabled=!sim.running;$('simSpeed').value=String(sim.speed);$('simLimit').value=String(sim.maxPeople);$('simStats').textContent=stats.distance.toFixed(1)+' m gång · '+Math.round(stats.waitTime)+' s väntan · '+stats.delivered+' påsar lämnade';
  $('personInspector').hidden=!p;
  if(p&&(force||!$('personInspector').contains(document.activeElement))){$('personName').value=p.name;$('personAppearance').value=p.appearance;$('personHeight').value=Math.round(p.height*100);$('personMode').value=p.mode;$('personPaused').checked=p.paused;$('personX').value=p.start.x.toFixed(2);$('personZ').value=p.start.z.toFixed(2);$('followPerson').textContent=followId===p.id?'Sluta följa':'Följ person';$('personState').textContent=({idle:'Vilar',walk:'Går',turn:'Vänder',look:'Ser sig omkring',gesture:'Paus / gest',phone:'Telefonpaus',dance:'Dance Break',deliver:'Lämnar material',wait:'Väntar'})[p.state]||p.state;}
  const signature=sim.people.map(p=>p.id+':'+p.name+':'+p.appearance+':'+p.paused).join('|')+selectedId;
  if(signature!==lastPeopleSignature||force){lastPeopleSignature=signature;const list=$('peopleList');list.replaceChildren();if(!sim.people.length)list.append(element('p','empty-list','Rummet börjar utan personer. Välj en kollega ovan och klicka på golvet.'));for(const person of sim.people){const b=element('button','person-row'+(person.id===selectedId?' selected':'')),dot=element('i');dot.style.background=person.mode==='handler'?'#e99b59':'#638d86';b.append(dot,element('span','',person.name),element('small','',person.paused?'PAUS':person.mode==='handler'?'MH':'NPC'));b.onclick=()=>select(person.id);list.append(b);}}
  if($('handlerDestination')){const ds=sim.getDestinations(),sig=ds.map(d=>d.id+':'+d.name).join('|');if(sig!==lastDestinationSignature||force){lastDestinationSignature=sig;const sel=$('handlerDestination'),old=sel.value;sel.replaceChildren(new Option('Välj upphämtningsstation…',''));for(const d of ds)sel.append(new Option(d.name,d.kind+':'+d.id));sel.value=p?.destination?(p.destination.objectId?'object:'+p.destination.objectId:'zone:'+p.destination.zoneId):old;const ng=$('simNoGo');ng.replaceChildren();for(const d of ds.filter(d=>d.kind==='zone')){const label=element('label','toggle-row',d.name),input=document.createElement('input');input.type='checkbox';input.checked=sim.noGoZoneIds.includes(d.id);input.onchange=()=>{sim.setNoGoZones([...ng.querySelectorAll('input:checked')].map(i=>i.dataset.zone));invalidate();};input.dataset.zone=d.id;label.append(input);ng.append(label);}if(!ng.children.length)ng.append(element('p','subtle-note','Rita en zon eller ett område under 5S för att kunna välja en no-go-yta.'));}}
  if($('simChaos')){$('simChaos').checked=sim.chaos;$('heatmapVisible').checked=sim.heatmapVisible;$('heatmapCollect').checked=sim.collectHeatmap;}
 }
 function tick(dt){if(!sim.people.length&&!followId)return false;let changed=sim.people.length?sim.tick(dt):false;uiClock+=dt;if(uiClock>.3){uiClock=0;refresh();}
  if(followId){const p=sim.people.find(p=>p.id===followId);if(!p)followId=null;else{const alpha=1-Math.exp(-dt*4),back=[-Math.sin(p.yaw)*2.4,1.9,-Math.cos(p.yaw)*2.4],target=[p.x,p.height*.63,p.z],eye=[p.x+back[0],p.height*.65+back[1],p.z+back[2]];state.mode='orbit';state.transition=null;state.target=state.target.map((v,i)=>v+(target[i]-v)*alpha);state.eye=state.eye.map((v,i)=>v+(eye[i]-v)*alpha);changed=true;}}
  // Reduce character detail after sustained slow frames; never change furniture.
  if(sim.running&&dt>0){frameAverage=frameAverage?frameAverage*.97+dt*.03:dt;if(quality==='auto'){if(frameAverage>.033)adaptiveLow=true;else if(frameAverage<.022)adaptiveLow=false;}}
  return changed;
 }
 function path(points,fill,stroke){const ps=points.map(([x,z])=>project([x,.035,z]));if(ps.some(p=>!p))return;ctx.beginPath();ctx.moveTo(...ps[0]);ps.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
 function drawUnderlay(){if(state.mode!=='plan'||!sim.heatmapVisible)return;const map=sim.getHeatmap(),r=map.cellSize*.53;ctx.save();for(const cell of map.cells){const hue=225-Math.pow(cell.value,.65)*225;path([[cell.x-r,cell.z-r],[cell.x+r,cell.z-r],[cell.x+r,cell.z+r],[cell.x-r,cell.z+r]],`hsla(${hue},85%,48%,.43)`);}ctx.restore();}
 function bubble(p,text){const q=project([p.x,p.height+.25,p.z]);if(!q)return;const {width,height}=api.viewport();if(q[0]<20||q[0]>width-20||q[1]<25||q[1]>height-30)return;ctx.font='600 11px system-ui';const w=Math.min(230,ctx.measureText(text).width+22),x=Math.max(8,Math.min(width-w-8,q[0]-w/2)),y=q[1]-27;ctx.fillStyle='rgba(255,255,249,.97)';ctx.strokeStyle='#9eb3aa';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,y,w,27,9);ctx.fill();ctx.stroke();ctx.fillStyle='#294d46';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.slice(0,45),x+w/2,y+14);}
 function drawHUD(){ctx.save();for(const prop of sim.props)if(state.mode==='plan')path(C.corners(prop),'#c39165bb','#795b44');for(const p of [...sim.people,...(ghost?[ghost]:[])]){const q=project([p.x,.06,p.z]);if(!q)continue;if(state.mode==='plan'){const edge=project([p.x+.28,.06,p.z]),r=Math.max(6,Math.hypot(edge[0]-q[0],edge[1]-q[1]));ctx.fillStyle=p.id===selectedId?'#f3b969':p.appearance==='material-handler'?'#cc8751':'#3e7d71';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(...q,r,0,Math.PI*2);ctx.fill();ctx.stroke();const dx=Math.sin(p.yaw),dz=Math.cos(p.yaw),tip=project([p.x+dx*.43,.06,p.z+dz*.43]);ctx.strokeStyle='#284c48';ctx.beginPath();ctx.moveTo(...q);ctx.lineTo(...tip);ctx.stroke();ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#294c45';ctx.fillText(p.name||'Placera',q[0],q[1]+r+13);}else if(p.id===selectedId){const a=project([p.x+.34,.03,p.z]),r=Math.max(5,Math.hypot(a[0]-q[0],a[1]-q[1]));ctx.strokeStyle='#f0b454';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q[0],q[1],r,r*.38,0,0,Math.PI*2);ctx.stroke();}
   if(p.bubble)bubble(p,p.bubble);
  }ctx.restore();}
 function temporaryObjects(){const list=sim.props.slice();for(const p of sim.people)if(p.carryBag){const c=C.byType.sampleBag;list.push({id:'carry-'+p.id,type:'sampleBag',x:p.x+Math.sin(p.yaw)*.36,z:p.z+Math.cos(p.yaw)*.36,y:p.height*.48,rot:p.yaw*180/Math.PI,w:c.w,d:c.d,h:c.h,params:{}});}return list;}
 function drawProps(){if(state.mode==='plan')return;const list=temporaryObjects();if(!list.length)return;gl.uniform1i(U.instanced,0);gl.uniform1i(U.type,0);gl.uniform1f(U.clip,100);gl.bindTexture(gl.TEXTURE_2D,api.whiteTexture);const transparent=[];for(const o of list){const m=C.matrix(o);for(const part of planner.resource(o).parts){const color=C.MATS[part.mat],draw=()=>{gl.uniformMatrix4fv(U.model,false,m.model);gl.uniformMatrix3fv(U.normal,false,m.normal);gl.uniform4fv(U.color,color);gl.uniform1f(U.rough,.65);gl.uniform1f(U.metal,0);gl.bindVertexArray(part.vao);gl.drawArrays(gl.TRIANGLES,0,part.count);};if(color[3]<1)transparent.push(draw);else draw();}}gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);transparent.forEach(f=>f());gl.depthMask(true);gl.disable(gl.BLEND);}
 function drawPeople(vp){if(state.mode==='plan')return;renderer.draw([...sim.people,...(ghost?[ghost]:[])],{vp,eye:state.eye,quality:quality==='auto'&&adaptiveLow?'low':quality,selectedId});}
 function togglePhoto(value=!photo){photo=!!value;if(photo){photoWasRunning=sim.running;sim.pause();cancel();selectedId=null;}else if(photoWasRunning)sim.start();document.body.classList.toggle('photo-mode',photo);$('exitPhoto').hidden=!photo;$('photoSavePNG').hidden=!photo;invalidate();}
 function exportScenario(includeLayout=false){const config=sim.exportConfig();return{format:'hissrum12-v5-scenario',version:1,simulation:config,elevator:elevator.snapshot(),...(includeLayout?{layout:planner.snapshot()}:{}),display:{quality}};}
 function setQuality(value){
  if(!['auto','low','high'].includes(value))throw Error('Ogiltig grafiknivå. Välj Automatisk, Låg eller Hög.');
  quality=value;adaptiveLow=false;frameAverage=0;$('simQuality').value=quality;invalidate();
 }
 function importScenario(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Okänt scenarioschema.');
  if(value.format==='hissrum12-v5-simulation'){sim.importConfig(value);refresh(true);invalidate();return;}
  if(value.format!=='hissrum12-v5-scenario'||value.version!==1||!value.simulation)throw Error('Okänt scenarioschema.');
  const layout=value.layout?C.validate(value.layout,api.info):null;
  let incomingQuality=quality;
  if(value.display!==undefined){
   if(!value.display||typeof value.display!=='object'||Array.isArray(value.display))throw Error('Ogiltiga visningsinställningar.');
   if(value.display.quality!==undefined){
    if(!['auto','low','high'].includes(value.display.quality))throw Error('Ogiltig grafiknivå i scenariot.');
    incomingQuality=value.display.quality;
   }
  }
  // Preflight the state that will actually be imported, BEFORE changing the
  // current layout. Using the current door with incoming furniture could reject
  // valid scenarios or approve one that then fails after replacing furniture.
  // Legacy annotation-only imports preserve furniture and door, just as restore.
  const currentLayout=planner.snapshot();
  const targetLayout=layout?.legacy?{...currentLayout,measures:layout.measures,zones:layout.zones}:layout||currentLayout;
  const targetDoor=layout&&!layout.legacy?layout.door:{...door.snapshot(),angle:door.degrees};
  const probe=PeopleSimulation.create({info:api.info,getLayout:()=>targetLayout,getDoor:()=>targetDoor,getElevator:()=>FreightElevatorGeometry});
  probe.importConfig(value.simulation);
  if(layout)planner.restore(value.layout,true);
  sim.importConfig(value.simulation);elevator.restore(value.elevator||{});
  setQuality(incomingQuality);selectedId=null;followId=null;cancel();refresh(true);invalidate();
 }
 function installCatalog(){const category='SIMULATION → PEOPLE';$('catalogCategory').append(new Option(category,category));for(const v of variants){const b=element('button','object-card person-card');b.dataset.person=v.id;b.dataset.category=category;b.dataset.search=v.label+' simulation people person människa';const canvas=document.createElement('canvas');renderer.thumbnail(canvas,v.id);b.append(canvas,element('strong','',v.label),element('small','',Math.round(v.height*100)+' cm · separat simulering'));b.onclick=()=>beginPlace(v.id);b.draggable=true;b.ondragstart=e=>{beginPlace(v.id);e.dataTransfer.setData('application/x-hissrum-person',v.id);};$('objectCatalog').append(b);const card=b.cloneNode(true);const cv=card.querySelector('canvas');renderer.thumbnail(cv,v.id);card.draggable=false;card.onclick=()=>beginPlace(v.id);$('peopleCatalog').append(card);}
  $('catalogSearch').dispatchEvent(new Event('input'));host.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-hissrum-person'))e.preventDefault();});host.addEventListener('drop',e=>{const id=e.dataTransfer.getData('application/x-hissrum-person');if(!byVariant.has(id))return;e.preventDefault();const f=floorAt(e);if(f&&sim.isFree(f.x,f.z)){const v=byVariant.get(id),p=sim.add({appearance:id,height:v.height,x:f.x,z:f.z,mode:id==='material-handler'?'handler':'roam'});if(p){cancel();select(p.id);}}});
 }
 on('simStart',()=>{sim.start();refresh();invalidate();});on('simPause',()=>{sim.pause();refresh();invalidate();});on('simReset',()=>{sim.reset();followId=null;refresh(true);invalidate();});$('simSpeed').onchange=e=>sim.setSpeed(Number(e.target.value));$('simLimit').onchange=e=>{sim.maxPeople=Number(e.target.value);if(sim.people.length>sim.maxPeople)toast('Gränsen gäller nya personer. Ta bort personer för att minska nuvarande antal.');};$('simQuality').onchange=e=>setQuality(e.target.value);
 for(const v of variants)$('personAppearance').append(new Option(v.label,v.id));
 for(const [id,key,read]of[['personName','name',el=>el.value],['personAppearance','appearance',el=>el.value],['personHeight','height',el=>Number(el.value)/100],['personMode','mode',el=>el.value],['personPaused','paused',el=>el.checked]])$(id).onchange=e=>{if(selectedId)sim.update(selectedId,{[key]:read(e.target)});refresh(true);invalidate();};
 for(const id of['personX','personZ'])$(id).onchange=()=>{if(selectedId)sim.move(selectedId,Number($('personX').value),Number($('personZ').value));refresh(true);invalidate();};
 on('personDuplicate',()=>{if(selectedId){const p=sim.duplicate(selectedId);if(p)select(p.id);}});on('personDelete',()=>{sim.remove(selectedId);selectedId=null;refresh(true);invalidate();});on('personDeselect',()=>select(null));on('followPerson',()=>{followId=followId===selectedId?null:selectedId;state.transition=null;state.tool='view';refresh(true);invalidate();});on('cancelPersonPlacement',cancel);on('photoMode',()=>togglePhoto());on('exitPhoto',()=>togglePhoto(false));on('photoSavePNG',()=>$('saveImage').click());
 on('simExport',()=>download(JSON.stringify(exportScenario($('simIncludeLayout')?.checked),null,2),'Hissrum12_V5_simulation.json','application/json'));on('simImport',()=>$('simFile').click());$('simFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('Simulationsfilen är för stor.');importScenario(JSON.parse(await file.text()));toast('Scenario inläst. Starta simuleringen.');}catch(err){toast(err.message);}e.target.value='';};
 installCatalog();refresh(true);
 return{tick,handlePointer,handleKey,drawUnderlay,drawHUD,drawProps,drawPeople,select,beginPlace,cancel,refresh,exportScenario,importScenario,togglePhoto,stopFollow:()=>{followId=null;},get selectedId(){return selectedId;},get quality(){return quality;},get adaptiveLow(){return adaptiveLow;},get following(){return followId;}};
}
