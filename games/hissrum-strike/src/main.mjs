import * as THREE from 'three';
import {createHissrumWorld,MINIATURE_SCALE} from './world.mjs';
import {Game,WEAPONS} from './fps/game.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'),coarse=matchMedia('(pointer:coarse)').matches;
const keys=new Set(),actors=new Map(),hostages=new Map();
const settings={sensitivity:.0021,mobileSensitivity:.0065};
let scene,renderer,camera,world,game,modelRoot,weaponRoot,muzzle,weaponWobble=0,gunKick=0,shotUntil=0;
let active=false,paused=false,lookYaw=0,lookPitch=0,fire=false,interact=false,touchFire=false,touchJump=false,touchForward=0,touchStrafe=0;
let mapBackdrop=null,tracers=[],tracerCursor=0,lastFrame=0,lastHud=0,noticeUntil=0,hitUntil=0,damageUntil=0;
let currentPhase='',currentWeapon='',spectateActor=null;

function progress(message){$('loading-text').textContent=message;console.info('[hissrum-strike] '+message);}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const asTime=n=>{const t=Math.max(0,Math.ceil(n));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
function notice(value,seconds=2.3){$('notify').textContent=value;noticeUntil=performance.now()+seconds*1000;}
function setHidden(id,hidden){$(id).hidden=hidden;}

function setupGraphics(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#172630');
  scene.fog=new THREE.FogExp2('#172630',.0025);
  camera=new THREE.PerspectiveCamera(coarse?81:74,innerWidth/innerHeight,.055,220);
  camera.rotation.order='YXZ';
  renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.65));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.7;
  renderer.shadowMap.enabled=false; // Baked GLB scene + lightweight dynamic actors.
  scene.add(new THREE.HemisphereLight('#ecfbff','#758f97',2.5));
  const sun=new THREE.DirectionalLight('#f4fff8',2.7);
  sun.position.set(-21,45,31);scene.add(sun);
  scene.add(camera);
  initViewWeapon();
  initTracers();
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
}

const geometry={
  body:new THREE.CapsuleGeometry(.21,.7,3,8),
  head:new THREE.SphereGeometry(.235,10,7),
  visor:new THREE.BoxGeometry(.28,.12,.10),
  leg:new THREE.CapsuleGeometry(.10,.37,2,6),
  rifle:new THREE.BoxGeometry(.11,.11,.55),
  arm:new THREE.BoxGeometry(.13,.41,.17),
  backpack:new THREE.BoxGeometry(.32,.4,.16)
};
const mat=(color,metalness=.15)=>new THREE.MeshStandardMaterial({color,roughness:.67,metalness});
const teamMats={
 analysts:{suit:mat('#168d95'),highlight:mat('#a3fff0'),helmet:mat('#173e4b'),visor:mat('#80fded',.65)},
 counterAnalysts:{suit:mat('#a35832'),highlight:mat('#ffbb77'),helmet:mat('#442a2a'),visor:mat('#ed944a',.65)},
 hostage:{suit:mat('#717f9a'),highlight:mat('#f5e5bc'),helmet:mat('#c1ccd3'),visor:mat('#e8ded4')}
};
const darkMat=mat('#1a2931',.62);
function part(group,geo,material,x,y,z){
 const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function makeCharacter(team){
 const m=teamMats[team],root=new THREE.Group();
 part(root,geometry.body,m.suit,0,.96,0);
 part(root,geometry.head,m.helmet,0,1.53,-.01);
 part(root,geometry.visor,m.visor,0,1.55,-.23);
 part(root,geometry.backpack,m.highlight,0,.96,.21);
 part(root,geometry.leg,darkMat,-.12,.36,.01);
 part(root,geometry.leg,darkMat,.12,.36,.01);
 part(root,geometry.arm,m.suit,-.27,1.0,-.06);
 part(root,geometry.arm,m.suit,.27,1.0,-.06);
 if(team!=='hostage')part(root,geometry.rifle,darkMat,.10,1.07,-.35);
 scene.add(root);return root;
}
function clearCharacters(){
 for(const object of [...actors.values(),...hostages.values()])scene.remove(object);
 actors.clear();hostages.clear();
}
function syncCharacters(dt){
 if(!game)return;
 const cameraActor=spectateActor||game.player;
 for(const actor of game.actors){
   let visual=actors.get(actor.id);
   if(!visual){visual=makeCharacter(actor.team);actors.set(actor.id,visual);}
   visual.visible=actor.alive&&actor!==cameraActor;
   if(!visual.visible)continue;
   visual.position.set(actor.x,actor.y,actor.z);
   visual.rotation.y=actor.yaw;
   visual.scale.setScalar(actor.height/1.7);
   const legs=visual.children[4],otherLeg=visual.children[5];
   const gait=game.state.time*11+(actor.index||0);
   const step=Math.min(.16,actor.moving*.03);
   legs.rotation.x=Math.sin(gait)*step;
   otherLeg.rotation.x=-Math.sin(gait)*step;
 }
 for(const hostage of game.hostages){
   let visual=hostages.get(hostage.id);
   if(!visual){visual=makeCharacter('hostage');hostages.set(hostage.id,visual);}
   visual.visible=hostage.alive!==false&&!hostage.rescued;
   if(!visual.visible)continue;
   visual.position.set(hostage.x,hostage.y||0,hostage.z);
   visual.rotation.y=hostage.yaw||0;
   visual.scale.setScalar((hostage.height||1.6)/1.7);
 }
}

function initViewWeapon(){
 weaponRoot=new THREE.Group();weaponRoot.position.set(.28,-.29,-.50);camera.add(weaponRoot);
 const g=new THREE.BoxGeometry(.18,.13,.63),body=new THREE.Mesh(g,mat('#263c46',.7));
 weaponRoot.add(body);
 part(weaponRoot,new THREE.BoxGeometry(.10,.09,.28),darkMat,-.025,.08,-.14);
 part(weaponRoot,new THREE.CylinderGeometry(.045,.045,.32,10),darkMat,0,.015,-.45).rotation.x=Math.PI/2;
 part(weaponRoot,new THREE.BoxGeometry(.10,.28,.13),mat('#446574'),.035,-.19,.09);
 part(weaponRoot,new THREE.BoxGeometry(.09,.07,.08),mat('#80e9d1'),-.02,.15,-.29);
 part(weaponRoot,new THREE.BoxGeometry(.14,.21,.19),mat('#728d83'),-.12,-.13,.13);
 muzzle=part(weaponRoot,new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color:'#ffe1a0'}),0,.016,-.62);
 muzzle.visible=false;
}
function initTracers(){
 for(let i=0;i<38;i++){
   const buffer=new THREE.BufferGeometry();
   buffer.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
   const line=new THREE.Line(buffer,new THREE.LineBasicMaterial({color:i%2?'#f5b172':'#a9fff2',transparent:true,opacity:.75,depthWrite:false}));
   line.visible=false;scene.add(line);tracers.push({line,until:0});
 }
}
function showTracer(event){
 const item=tracers[tracerCursor++%tracers.length],p=item.line.geometry.attributes.position;
 p.setXYZ(0,event.from.x,event.from.y,event.from.z);
 p.setXYZ(1,event.to.x,event.to.y,event.to.z);
 p.needsUpdate=true;item.line.material.color.set(event.team==='analysts'?'#8ffaf1':'#ffa26d');
 item.until=performance.now()+85;item.line.visible=true;
}
function startGame(){
 if(!world)return;
 clearCharacters();
 const mode=$('mode').value,difficulty=$('difficulty').value,loadout=$('loadout').value;
 game=new Game(world,{
   seed:42,team:'analysts',difficulty,
   config:{mode,difficulty,loadout,firefight:false,wanderers:false,friendlyFire:false,
     buyTime:2,startMoney:4900,roundTime:150,matchWins:5,
     respawnDelay:2.7,spawnProtection:1.4,botSpeed:3.2,runSpeed:4.6}
 });
 game.start('analysts');
 if(mode==='classic')game.buy(loadout);
 game.pause(false);
 lookYaw=game.player.yaw;lookPitch=.085;currentPhase='';currentWeapon='';
 active=true;paused=false;keys.clear();fire=false;touchFire=false;interact=false;
 weaponRoot.visible=true;setHidden('menu',true);setHidden('pause',true);
 setHidden('match-end',true);setHidden('hud',false);
 setHidden('touch-controls',!coarse);
 notice('DU ÄR MINIATYR · HISSRUM 12',3);
 if(!coarse)requestLock();
}
function requestLock(){
 if(!canvas.requestPointerLock)return;
 try{const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{});}catch{}
}
function pauseGame(){
 if(!game||!active||paused)return;
 paused=true;game.pause(true);keys.clear();fire=false;touchFire=false;interact=false;
 setHidden('pause',false);setHidden('touch-controls',true);
 if(document.pointerLockElement===canvas)document.exitPointerLock();
}
function resumeGame(){
 if(!game||!active)return;
 paused=false;game.pause(false);setHidden('pause',true);
 setHidden('touch-controls',!coarse);
 lastFrame=performance.now();
 if(!coarse)requestLock();
}
function mainMenu(){
 active=false;paused=false;if(game)game.pause(true);
 game=null;clearCharacters();keys.clear();fire=false;touchFire=false;
 setHidden('pause',true);setHidden('match-end',true);setHidden('hud',true);
 setHidden('touch-controls',true);setHidden('menu',false);
 weaponRoot.visible=false;
 if(document.pointerLockElement===canvas)document.exitPointerLock();
}
const feed=[];
function addKill(event){
 const source=game.actors.find(a=>a.id===event.sourceId);
 const target=game.actors.find(a=>a.id===event.actorId);
 if(!target)return;
 feed.unshift({name:(source?.name||'Miljön')+'  ×  '+target.name,team:source?.team||'',until:performance.now()+4200});
 feed.splice(5);
}
function updateEvents(){
 for(const event of game.drainEvents()){
   if(event.type==='tracer'&&event.from&&event.to)showTracer(event);
   if(event.type==='kill')addKill(event);
   if(event.type==='combat-hit'&&event.actorId===game.player.id)hitUntil=performance.now()+170;
   if(event.type==='damage'&&event.actorId===game.player.id)damageUntil=performance.now()+220;
   if(event.type==='shot'&&event.actorId===game.player.id){shotUntil=performance.now()+75;gunKick=.085;}
   if(event.type==='reload'&&event.actorId===game.player.id)notice('LADDAR OM',1.4);
   if(event.type==='planted')notice('BOMBEN PLANTERAD',3.2);
   if(event.type==='defuse')notice('DESARMERING PÅGÅR',2);
   if(event.type==='rescue')notice('GISSLAN RÄDDAD',2);
   if(event.type==='round')notice('RUNDA '+event.round,2);
 }
}
function cameraFollow(dt){
 const p=game?.player;
 if(!p)return;
 spectateActor=p.alive?p:game.spectator;
 const a=spectateActor||p;
 if(a.isPlayer){camera.rotation.set(a.pitch,a.yaw,0,'YXZ');}
 else camera.rotation.set(a.pitch||0,a.yaw||0,0,'YXZ');
 const bob=p.alive&&p.moving>.2&&!p.crouching?Math.sin(game.state.time*12)*Math.min(.032,p.moving*.008):0;
 camera.position.set(a.x,a.y+a.height-.13+bob,a.z);
 weaponRoot.visible=p.alive;
 gunKick=Math.max(0,gunKick-dt*.45);
 weaponWobble+=(Math.min(1,p.moving/4)-weaponWobble)*Math.min(1,dt*7);
 weaponRoot.position.set(.30,-.31+Math.sin(game.state.time*10)*.015*weaponWobble-gunKick*.3,-.52+gunKick);
 weaponRoot.rotation.set(gunKick*.8,0,Math.sin(game.state.time*7)*.026*weaponWobble);
 const w=WEAPONS[p.weapon];
 if(w?.slot==='pistol')weaponRoot.scale.set(.7,.8,.68);
 else if(w?.slot==='knife')weaponRoot.scale.set(.28,.5,.68);
 else weaponRoot.scale.set(1,1,1);
 muzzle.visible=performance.now()<shotUntil;
}
function activeInput(){
 const p=game?.player;
 return {yaw:lookYaw,pitch:lookPitch,
  forward:clamp((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+touchForward,-1,1),
  strafe:clamp((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchStrafe,-1,1),
  sneak:keys.has('ShiftLeft')||keys.has('ShiftRight'),
  crouch:keys.has('ControlLeft')||keys.has('ControlRight'),
  jump:keys.has('Space')||touchJump,
  fire:fire||touchFire,
  interact:keys.has('KeyE')||interact
 };
}
function paintMapBackground(){
 const c=document.createElement('canvas');c.width=c.height=190;
 const ctx=c.getContext('2d'),b=world.bounds;
 const width=b.max.x-b.min.x,depth=b.max.z-b.min.z;
 const xy=(x,z)=>({x:8+(x-b.min.x)/width*174,y:8+(z-b.min.z)/depth*174});
 ctx.fillStyle='#0d252d';ctx.fillRect(0,0,190,190);
 ctx.fillStyle='#395e64';
 const step=world.navigation.spacing;
 for(const n of world.navigation.nodes){
   const p=xy(n.x,n.z);
   ctx.fillRect(p.x-step/width*87,p.y-step/depth*87,Math.max(1,step/width*174),Math.max(1,step/depth*174));
 }
 // The map uses actual 3D mesh footprints, not invented generic corridors.
 // Room shell stays in the background; all authored movable GLB objects are
 // projected using their precise model transformations in world metres.
 let propCount=0;
 world.model.updateMatrixWorld(true);
 world.model.traverse(object=>{
   if(!object.isMesh)return;
   if(/^(?:floor|north|south|east|west|ceiling|beam|pier|services|base)(?:__|_)/i.test(object.name))return;
   const box=new THREE.Box3().setFromObject(object);
   if(box.isEmpty())return;
   const sw=box.max.x-box.min.x,sd=box.max.z-box.min.z;
   if(sw>width*.8||sd>depth*.8||sw<.04||sd<.04)return;
   const a=xy(box.min.x,box.min.z),z=xy(box.max.x,box.max.z);
   const fixed=/fixed_south/.test(object.name);
   ctx.fillStyle=fixed?'#627b83':/vagn|pall|creform|cart|rack|truck/i.test(object.name)?'#cc9870':'#759a9a';
   ctx.fillRect(a.x,a.y,Math.max(1,z.x-a.x),Math.max(1,z.y-a.y));
   propCount++;
 });
 ctx.strokeStyle='#a3cbd0';ctx.lineWidth=1.2;ctx.strokeRect(7.5,7.5,175,175);
 const elevator=xy((b.min.x+b.max.x)/2+width*.132,b.min.z+depth*.032);
 ctx.strokeStyle='#71e8e3';ctx.lineWidth=4;
 ctx.beginPath();ctx.moveTo(elevator.x-11,elevator.y);ctx.lineTo(elevator.x+11,elevator.y);ctx.stroke();
 world.statistics.mappedProps=propCount;
 return c;
}
function drawMinimap(){
 if(!world||!game||!mapBackdrop)return;
 const ctx=$('minimap').getContext('2d'),b=world.bounds,w=b.max.x-b.min.x,d=b.max.z-b.min.z;
 ctx.clearRect(0,0,190,190);ctx.drawImage(mapBackdrop,0,0);
 const xy=p=>[8+(p.x-b.min.x)/w*174,8+(p.z-b.min.z)/d*174];
 function dot(p,color,r=3){const [x,y]=xy(p);ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 if(game.config.mode==='classic'){
   dot(world.anchors.bomb,'#ffe07a',5);
   for(const h of game.hostages)if(!h.rescued)dot(h,'#dfefef',3);
   dot(world.anchors.rescue,'#83ff8c',5);
 }
 for(const a of game.actors)if(a.alive&&!a.isPlayer)dot(a,a.team==='analysts'?'#77eee0':'#f89e63',3);
 if(game.player.alive){
   const a=game.player,[x,y]=xy(a);
   ctx.fillStyle='#fff';ctx.beginPath();
   ctx.moveTo(x-Math.sin(a.yaw)*7,y-Math.cos(a.yaw)*7);
   ctx.lineTo(x+Math.sin(a.y+.6)*6,y+Math.cos(a.y+.6)*6);
   ctx.lineTo(x+Math.sin(a.y-.6)*6,y+Math.cos(a.y-.6)*6);
   ctx.closePath();ctx.fill();
 }
}
function renderFeed(now){
 while(feed.length&&feed[feed.length-1].until<now)feed.pop();
 const node=$('killfeed');node.replaceChildren();
 for(const item of feed){
   const div=document.createElement('div');div.textContent=item.name;
   div.className=item.team==='analysts'?'friendly':'';node.append(div);
 }
}
function refreshHUD(now){
 if(!game)return;
 const s=game.state,p=game.player;
 $('score-a').textContent=s.score.analysts;
 $('score-b').textContent=s.score.counterAnalysts;
 $('alive-a').textContent=game.actors.filter(a=>a.alive&&a.team==='analysts').length;
 $('alive-b').textContent=game.actors.filter(a=>a.alive&&a.team==='counterAnalysts').length;
 $('round').textContent=s.mode==='endless'?'ENDLESS ACTION':'RUNDA '+s.round;
 $('phase').textContent=s.phase==='buy'?'FÖRBEREDELSE':s.phase==='active'?'STRID':s.phase==='result'?'AVGJORD':'MATCH';
 let timer=s.phase==='buy'?s.buyDeadline-s.time:s.mode==='endless'?s.time-s.roundStartedAt:s.deadline-s.time;
 if(s.bomb.status==='planted')timer=s.bomb.deadline-s.time;
 $('clock').textContent=asTime(timer);
 $('health').textContent=Math.max(0,Math.ceil(p.hp));
 $('armor').textContent='RUSTNING '+Math.ceil(p.armor||0);
 const weapon=WEAPONS[p.weapon],item=game.item(p);
 $('weapon').textContent=weapon?.name||'INGET VAPEN';
 $('ammo').textContent=item?.ammo===Infinity?'∞':item?.ammo??'—';
 $('reserve').textContent=item?.reserve??'—';
 $('reload-hint').textContent=p.reloadUntil>s.time?'LADDAR OM': 'R · LADDA OM';
 $('health').style.color=p.hp<30?'#ff9584':'#f5fcfc';
 $('mission').textContent=s.mode==='endless'?'5 MOT 5 · MINIATYRSTRID I HISSRUM 12':
   s.bomb.status==='planted'?'DESARMERA BOMBEN · SKYDDA GISSLAN':
   'FÖRSVARA HISSRUMMET · HINDRA PLANTERING OCH RÄDDNING';
 $('spectating').hidden=p.alive;
 if(!p.alive){const at=p.respawnAt;const time=Number.isFinite(at)?' · '+Math.max(0,Math.ceil(at-s.time))+'s':' · NÄSTA RUNDA';
   $('spectate-name').textContent=(game.spectator?.name||'LAGKAMRAT')+time;}
 $('notify').style.opacity=now<noticeUntil?'1':'0';
 $('hit').style.opacity=now<hitUntil?'1':'0';
 $('damage').style.boxShadow=now<damageUntil?'inset 0 0 17vw rgba(255,40,30,.48)':'inset 0 0 17vw rgba(255,40,30,0)';
 renderFeed(now);drawMinimap();
 if(s.phase==='match'){
   active=false;game.pause(true);
   $('winner').textContent=s.score.analysts>=game.config.matchWins?'ANALYSTS VANN':'COUNTER VANN';
   setHidden('match-end',false);setHidden('touch-controls',true);
   if(document.pointerLockElement===canvas)document.exitPointerLock();
 }
}
function frame(now){
 requestAnimationFrame(frame);
 if(!renderer)return;
 const dt=Math.min(.05,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
 if(game&&active&&!paused){
   if(game.phase!=='match')game.update(dt,activeInput());
   updateEvents();syncCharacters(dt);cameraFollow(dt);
   if(now-lastHud>100){refreshHUD(now);lastHud=now;}
 }else{
   if(world&&!game){
     const b=world.bounds,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2;
     camera.position.set(cx-15,16,cz+28);
     camera.lookAt(cx,2,cz);
   }
 }
 for(const t of tracers)if(t.until<now)t.line.visible=false;
 renderer.render(scene,camera);
}

window.addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(active&&!paused)pauseGame();return;}
 if(!game||!active||paused||e.repeat)return;
 if(e.code==='KeyR')game.reload();
 if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4')game.select(e.code.at(-1));
 if(e.code==='KeyQ')game.select('last');
 if(e.code==='KeyB'&&game.config.mode==='classic'){const result=game.buy($('loadout').value);notice(result.ok?'VAPEN KÖPT':result.reason);}
 if(e.code==='KeyP')pauseGame();
 keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseGame();});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&active&&!paused){fire=true;if(!coarse&&document.pointerLockElement!==canvas)requestLock();}});
window.addEventListener('mouseup',()=>fire=false);
window.addEventListener('blur',()=>{keys.clear();fire=false;touchFire=false;if(active)pauseGame();});
document.addEventListener('mousemove',e=>{
 if(!active||paused||document.pointerLockElement!==canvas)return;
 lookYaw-=e.movementX*settings.sensitivity;
 lookPitch=clamp(lookPitch-e.movementY*settings.sensitivity,-1.48,1.48);
});
document.addEventListener('pointerlockchange',()=>{
 if(active&&!paused&&!coarse&&document.pointerLockElement!==canvas)pauseGame();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function setupTouch(){
 const pad=$('move-pad'),stick=$('move-stick'),look=$('look-zone');
 let movePointer=null,lookPointer=null,lookX=0,lookY=0;
 function padMove(e){
   const rect=pad.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
   const radius=Math.max(25,rect.width*.38);
   const x=clamp((e.clientX-cx)/radius,-1,1),y=clamp((e.clientY-cy)/radius,-1,1);
   const len=Math.hypot(x,y),f=len>1?1/len:1;
   touchStrafe=x*f;touchForward=-y*f;
   const thumbTravel=Math.max(16,(rect.width-stick.offsetWidth)/2-5);
   stick.style.transform='translate('+touchStrafe*thumbTravel+'px,'+(-touchForward)*thumbTravel+'px)';
 }
 pad.addEventListener('pointerdown',e=>{e.preventDefault();movePointer=e.pointerId;pad.setPointerCapture(movePointer);padMove(e);});
 pad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)padMove(e);});
 function resetPad(e){if(e.pointerId!==movePointer)return;movePointer=null;touchStrafe=touchForward=0;stick.style.transform='translate(0,0)';}
 pad.addEventListener('pointerup',resetPad);pad.addEventListener('pointercancel',resetPad);
 look.addEventListener('pointerdown',e=>{e.preventDefault();lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture(lookPointer);});
 look.addEventListener('pointermove',e=>{
   if(e.pointerId!==lookPointer||!active||paused)return;
   lookYaw-=(e.clientX-lookX)*settings.mobileSensitivity;
   lookPitch=clamp(lookPitch-(e.clientY-lookY)*settings.mobileSensitivity,-1.48,1.48);
   lookX=e.clientX;lookY=e.clientY;
 });
 const stopLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;};
 look.addEventListener('pointerup',stopLook);look.addEventListener('pointercancel',stopLook);
 for(const button of document.querySelectorAll('[data-touch]')){
   const action=button.dataset.touch;
   button.addEventListener('pointerdown',e=>{
     e.preventDefault();button.setPointerCapture(e.pointerId);
     if(action==='fire')touchFire=true;
     if(action==='jump')touchJump=true;
     if(action==='interact')interact=true;
     if(action==='reload')game?.reload();
     if(action==='switch')game?.select('last');
   });
   const reset=()=>{
     if(action==='fire')touchFire=false;
     if(action==='jump')touchJump=false;
     if(action==='interact')interact=false;
   };
   button.addEventListener('pointerup',reset);button.addEventListener('pointercancel',reset);
 }
}
$('start').addEventListener('click',startGame);
$('pause-button').addEventListener('click',pauseGame);
$('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',startGame);
$('back-menu').addEventListener('click',mainMenu);
$('play-again').addEventListener('click',startGame);
$('end-menu').addEventListener('click',mainMenu);
setupTouch();
setupGraphics();
requestAnimationFrame(frame);
try{
 world=await createHissrumWorld(progress);
 modelRoot=world.model;scene.add(modelRoot);
 mapBackdrop=paintMapBackground();
 if(new URLSearchParams(location.search).has('test')){
   // Browser visual regression hooks — never enabled for regular players.
   window.__hissrumInspect=()=>({
     floorReferenceY:world.statistics.floorReferenceY,
     floorTriangles:world.statistics.floorTriangles,
     modelBounds:{min:world.modelBounds.min.toArray(),max:world.modelBounds.max.toArray()},
     roomBounds:{min:world.bounds.min.toArray(),max:world.bounds.max.toArray()},
     camera:{position:camera.position.toArray(),yaw:camera.rotation.y,pitch:camera.rotation.x},
     player:game?.player?{x:game.player.x,y:game.player.y,z:game.player.z,yaw:game.player.yaw,height:game.player.height}:null,
     anchor:world.anchors.analysts[0],
     objects:world.statistics.meshCount,
     mappedProps:world.statistics.mappedProps,
     children:world.model.children.length,
     canvas:{width:canvas.width,height:canvas.height},
     render:renderer.info.render.calls,
     loaded:!!world
   });
 }
 setHidden('loading',true);
 $('start').disabled=false;$('start').textContent='STARTA MINI-MATCH';
}catch(error){
 console.error('[Hissrum Strike] Could not initialize model or navigation',error);
 progress('Kunde inte öppna spelplanen: '+(error?.message||String(error))+'. Öppna via en lokal HTTP-server eller GitHub Pages.');
 $('loading').classList.add('failed');
}
