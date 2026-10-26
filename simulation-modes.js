/* Optional modes operate exclusively on PeopleSimulation's temporary state. */
function setupSimulationModes({$,simulation:sim,simUI,planner,door,setView,invalidate,toast}){
 $('simulationModes').innerHTML=`
 <div class="sim-mode-card"><h3>MATERIAL HANDLER</h3><label class="field-label">Upphämtningsstation<select id="handlerDestination"><option value="">Välj upphämtningsstation…</option></select></label><button id="handlerRun" class="secondary-button">Starta leverans från hissen</button><p class="simulation-tip">Fyra påsar lämnas tillfälligt. En ny MH börjar i kabinen och väntar vid stängd dörr.</p><button id="handlerOpenDoor" class="link-small">Öppna hissdörren</button></div>
 <div class="sim-mode-card chaos"><label class="toggle-row"><strong>KAIZEN CHAOS</strong><input id="simChaos" type="checkbox"></label><p class="simulation-tip">Fel hylla, telefonpauser och ”det stod här igår”. Tillfälliga kartonger kan hamna i markerade zoner. Återställ rensar allt.</p><div class="mini-actions"><button id="kaizenMeeting">Kaizen-möte</button><button id="danceBreak">Dance Break</button></div></div>
 <div class="sim-mode-card"><h3>PEOPLE TRAFFIC HEATMAP</h3><label class="toggle-row">Visa rörelser i planvy<input id="heatmapVisible" type="checkbox"></label><label class="toggle-row">Samla trafikdata<input id="heatmapCollect" type="checkbox" checked></label><div class="heat-legend"></div><div class="heat-legend-labels"><span>Låg trafik</span><span>Hög trafik</span></div><button id="heatmapReset" class="link-small">Återställ heatmap</button><p class="simulation-tip">Relativ tid per ruta. Gångsträcka och väntetid visas ovan. Simulerad data, inte en ergonomisk analys.</p></div>
 <details class="gap-top"><summary>No-go-zoner för personer</summary><p class="subtle-note">Markera zoner som personer ska undvika. Vanliga fria passager är tillgängliga tills du väljer dem här.</p><div id="simNoGo" class="sim-no-go"></div></details>`;
 const refresh=()=>{simUI.refresh(true);invalidate();};
 $('handlerDestination').onchange=e=>{const p=sim.people.find(p=>p.id===simUI.selectedId);if(p?.mode==='handler'){const [kind,...parts]=e.target.value.split(':'),id=parts.join(':');sim.setDestination(p.id,id?{[kind==='object'?'objectId':'zoneId']:id}:null);}};
 $('handlerRun').onclick=()=>{const value=$('handlerDestination').value;if(!value){toast('Välj en upphämtningsstation först. Lägg till ett objekt eller markera en zon i din layout.');return;}
  const [kind,...parts]=value.split(':'),target={[kind==='object'?'objectId':'zoneId']:parts.join(':')};let p=sim.people.find(p=>p.id===simUI.selectedId&&p.mode==='handler');
  if(!p)p=sim.add({name:'Material Handler',appearance:'material-handler',mode:'handler',height:1.75,destination:target});else{sim.setDestination(p.id,target);sim.update(p.id,{paused:false});}
  if(!p)return;simUI.select(p.id);sim.start();refresh();if(door.degrees<55)toast('MH väntar i kabinen. Öppna hissdörren för att börja leveransen.');
 };
 $('handlerOpenDoor').onclick=()=>{door.setAngle(90,true);planner.externalChange();};
 $('simChaos').onchange=e=>{sim.setChaos(e.target.checked);refresh();};
 $('kaizenMeeting').onclick=()=>{if(sim.meeting())sim.start();refresh();};
 $('danceBreak').onclick=()=>{if(!sim.people.length){toast('Lägg till minst en person först.');return;}sim.danceBreak();sim.start();refresh();};
 $('heatmapVisible').onchange=e=>{sim.heatmapVisible=e.target.checked;if(e.target.checked)setView('plan',false);refresh();};
 $('heatmapCollect').onchange=e=>{sim.collectHeatmap=e.target.checked;refresh();};
 $('heatmapReset').onclick=()=>{sim.resetHeatmap();refresh();};
 refresh();
}
