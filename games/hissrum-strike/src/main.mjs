import * as THREE from 'three';
import {createHissrumWorld,MINIATURE_SCALE} from './world.mjs?v=hissrum-effects-v4';
import {Game,WEAPONS} from './fps/game.mjs?v=hissrum-ai-v5';
import {AudioSystem} from './audio.mjs';
import {CombatEffects} from './effects.mjs';
import {ActionVisuals} from './action-visuals.mjs';
import {loadCharacterLibrary,charactersReady,createAuthoredAvatar,animateAuthored,disposeAvatar,posedBounds} from './characters/character-library.mjs';
import {createStrikeViewWeapon,animateStrikeViewWeapon} from './weapon-kit/weapon-view.mjs';
import {corpseShouldShow,deathAge,poseAuthoredDeath,resumeAuthoredAfterRespawn,
  PLAYER_DEATH_CAMERA_SECONDS} from './characters/death-animation.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'),coarse=matchMedia('(pointer:coarse)').matches;
const keys=new Set(),actors=new Map(),hostages=new Map();
const settings={sensitivity:.0021,mobileSensitivity:.0065};
let scene,renderer,camera,world,game,modelRoot,weaponScene,weaponCamera,weaponModels=new Map(),activeViewModel,muzzle,gunKick=0,shotUntil=0,weaponShotAt=-Infinity,weaponSwitchAt=0;
let active=false,paused=false,lookYaw=0,lookPitch=0,fire=false,interact=false,touchFire=false,touchJump=false,touchDescend=false,aiming=false,touchForward=0,touchStrafe=0;
let mapBackdrop=null,tracers=[],tracerCursor=0,lastFrame=0,lastHud=0,noticeUntil=0,hitUntil=0,damageUntil=0;
let currentPhase='',currentWeapon='',spectateActor=null,pointerLockedAt=0;
let audioSystem=null,bloodEffects=null,actionVisuals=null,soundEnabled=true;

function progress(message){$('loading-text').textContent=message;console.info('[hissrum-strike] '+message);}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const asTime=n=>{const t=Math.max(0,Math.ceil(n));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
function notice(value,seconds=2.3){$('notify').textContent=value;noticeUntil=performance.now()+seconds*1000;}
function setHidden(id,hidden){$(id).hidden=hidden;}

function setupGraphics(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#42575e');
  scene.fog=null;
  camera=new THREE.PerspectiveCamera(coarse?84:76,innerWidth/innerHeight,.045,175);
  camera.rotation.order='YXZ';
  renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.65));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.72;
  renderer.shadowMap.enabled=false;
  scene.add(new THREE.AmbientLight('#eefaff',1.5));
  scene.add(new THREE.HemisphereLight('#f5fbff','#9db6bd',3.0));
  const sun=new THREE.DirectionalLight('#fcf8ed',2.1);
  sun.position.set(-18,41,23);scene.add(sun);
  scene.add(camera);
  initViewWeapon();
  initTracers();
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    if(weaponCamera){weaponCamera.aspect=innerWidth/innerHeight;weaponCamera.updateProjectionMatrix();}
    renderer.setSize(innerWidth,innerHeight);
  });
}

/** EXACT authored Quaternius skins and real animation clips from Cartridge Strike.
 *  Geometry, animations and textures are shared; skeleton and mixers are
 *  unique per actor so bots can move independently in the 1:6 room.
 */
function makeCharacter(team,id){
 if(!charactersReady())throw Error('Cartridge Strike character assets not ready');
 const root=new THREE.Group();
 const avatar=createAuthoredAvatar(team,id,team==='hostage');
 root.userData.avatar=avatar;
 root.userData.renderType='cartridge-strike-quaternius';
 root.add(avatar.holder);
 scene.add(root);
 return root;
}
function clearCharacters(){
 for(const visual of [...actors.values(),...hostages.values()]){
   scene.remove(visual);
   if(visual.userData.avatar)disposeAvatar(visual.userData.avatar);
 }
 actors.clear();hostages.clear();
}
function poseCharacter(visual,actor,now){
 const avatar=visual.userData.avatar;
 if(!actor.alive){
   if(corpseShouldShow(actor,now))poseAuthoredDeath(avatar,actor,now);
   return;
 }
 if(avatar.death)resumeAuthoredAfterRespawn(avatar);
 // Keep mobile GPU skinning smooth without evaluating 12 rigs at 60 FPS.
 const period=coarse?1/24:1/45;
 if(visual.userData.nextPoseTime!==undefined&&now<visual.userData.nextPoseTime)return;
 visual.userData.nextPoseTime=now+period;
 animateAuthored(avatar,actor,now);
}
function watchingPlayerDeath(){
 const p=game?.player;
 return p&&!p.alive&&deathAge(p,game.state.time)<PLAYER_DEATH_CAMERA_SECONDS;
}
function shouldRenderAvatar(actor,viewer){
 if(!viewer)return true;
 if(actor===viewer)return false;
 const dx=actor.x-viewer.x,dz=actor.z-viewer.z,dist=Math.hypot(dx,dz);
 if(dist<3)return true;
 const yaw=viewer.yaw||0;
 const forward=(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/dist;
 // The authored skinned meshes disable per-mesh frustum culling for accurate
 // animations. Cull the complete avatar when it's safely behind the camera.
 return forward>-.36;
}
function syncCharacters(dt){
 if(!game)return;
 const cameraActor=watchingPlayerDeath()?null:(spectateActor||game.player);
 for(const actor of game.actors){
   let visual=actors.get(actor.id);
   if(!visual){visual=makeCharacter(actor.team,actor.id);actors.set(actor.id,visual);}
   const recentlyDead=corpseShouldShow(actor,game.state.time);
   visual.visible=(actor.alive||recentlyDead)
     &&(watchingPlayerDeath()&&actor.isPlayer||shouldRenderAvatar(actor,cameraActor));
   if(!visual.visible)continue;
   visual.position.set(actor.x,actor.y,actor.z);
   visual.rotation.y=actor.yaw;
   // Authored crouch and jump clips handle body pose; do not squash the mesh
   // when Game changes its collision capsule height.
   visual.scale.setScalar(1);
   poseCharacter(visual,actor,game.state.time);
 }
 for(const hostage of game.hostages){
   let visual=hostages.get(hostage.id);
   if(!visual){visual=makeCharacter('hostage',hostage.id);hostages.set(hostage.id,visual);}
   visual.visible=hostage.alive!==false&&!hostage.rescued&&shouldRenderAvatar(hostage,cameraActor);
   if(!visual.visible)continue;
   visual.position.set(hostage.x,hostage.y||0,hostage.z);
   visual.rotation.y=hostage.yaw||0;
   visual.scale.setScalar(.95);
   poseCharacter(visual,hostage,game.state.time);
 }
}

function installRoomLighting(){
  // The original room surfaces may be single-sided with outward-facing normals.
  // Render original fixed surfaces from INSIDE. Do not invent replacement walls.
  const roomName=/^(base__|floor__|north__|south__|west__|east__|fixed_south__|ceiling_|beam__|services__)/i;
  let twoSided=0;
  modelRoot.traverse(object=>{
    if(!object.isMesh)return;
    const mats=Array.isArray(object.material)?object.material:[object.material];
    for(const material of mats){
      if(!material)continue;
      if(roomName.test(object.name||'')||roomName.test(object.parent?.name||'')){
        material.side=THREE.DoubleSide;material.needsUpdate=true;twoSided++;
      }
      if(/lamp$/i.test(material.name||'')){
        material.emissive=new THREE.Color('#ffe9b6');
        material.emissiveIntensity=.65;
      }
    }
  });
  const b=world.bounds,w=b.max.x-b.min.x,d=b.max.z-b.min.z;
  for(const [u,v] of [[.27,.27],[.73,.27],[.27,.72],[.73,.72]]){
    const light=new THREE.PointLight('#fff6e2',95,MINIATURE_SCALE*6.5,2);
    light.position.set(b.min.x+w*u,MINIATURE_SCALE*2.26,b.min.z+d*v);
    scene.add(light);
  }
  console.info('[Hissrum Strike] Interior material and fixture lights',{twoSided});
}
function initViewWeapon(){
  // Reproduce Cartridge Strike's dedicated 60° first-person renderer. Its
  // weapon meshes and CC0 gloves keep their original geometry and animations,
  // while world depth is cleared only for the presentation overlay.
  weaponScene=new THREE.Scene();
  weaponScene.add(new THREE.HemisphereLight(0xe2eff7,0x6c665b,1.5));
  const light=new THREE.DirectionalLight(0xffe7c8,2.05);
  light.position.set(-1,2,1);weaponScene.add(light);
  weaponCamera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.01,5);
  weaponCamera.rotation.order='YXZ';
  muzzle=new THREE.Mesh(new THREE.SphereGeometry(.058,9,7),
    new THREE.MeshBasicMaterial({color:0xffdf99,transparent:true,opacity:.92,depthWrite:false,depthTest:false}));
  muzzle.visible=false;weaponScene.add(muzzle);
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
function setScope(value){
 aiming=!!value&&!!game?.player?.alive&&game.player.weapon==='sniper';
 $('scope-toggle').setAttribute('aria-pressed',String(aiming));
 $('scope-toggle').classList.toggle('active',aiming);
 setHidden('scope-overlay',!aiming);
 document.body.classList.toggle('sniper-scoped',aiming);
 // Zoom must respond in the SAME input event, not depend on the next render
 // frame: large GLB scenes and mobile GPUs can miss several animation ticks.
 if(camera){camera.fov=aiming?19:(coarse?84:76);camera.updateProjectionMatrix();}
}
function clearScope(){
 setScope(false);
 if(camera){camera.fov=coarse?84:76;camera.updateProjectionMatrix();}
}
function syncSpecialHUD(){
 const p=game?.player;
 const flying=!!p?.alive&&!!p.flying;
 const sniper=!!p?.alive&&p.weapon==='sniper';
 if(!sniper&&aiming)setScope(false);
 $('flight-status').hidden=!flying;
 $('flight-toggle').classList.toggle('active',flying);
 $('flight-toggle').setAttribute('aria-pressed',String(flying));
 $('flight-toggle').textContent=flying?'LANDA':'FLYG';
 $('jump-button').textContent=flying?'UPP':'HOPPA';
 $('descend-button').hidden=!flying;
 $('scope-toggle').hidden=!sniper;
 if(!flying)touchDescend=false;
}
function toggleFlight(){
 if(!active||paused||!game?.player?.alive)return;
 const p=game.player;
 p.flying=!p.flying;
 p.vy=0;
 p.onGround=p.y<=.001;
 touchJump=false;touchDescend=false;
 syncSpecialHUD();
 notice(p.flying?'FLYGLÄGE · UPP: SPACE / HOPPA · NER: CTRL / NER':'FLYGLÄGE AV',2.3);
}
function configureSound(value,unlock=true){
 soundEnabled=!!value;
 $('sound-button').textContent=soundEnabled?'LJUD':'TYST';
 $('sound-button').setAttribute('aria-pressed',String(soundEnabled));
 $('sound-button').setAttribute('aria-label',soundEnabled?'Stäng av ljud':'Slå på ljud');
 audioSystem?.setVolume(soundEnabled?.55:0);
 if(unlock&&soundEnabled&&audioSystem&&game&&active){
   // Call synchronously from a real Start/Resume/mobile tap to unlock
   // AudioContext on iOS (not after an awaited promise).
   void audioSystem.unlock().catch(e=>console.warn('[Hissrum audio]',e));
 }
}
function toggleSound(){configureSound(!soundEnabled);}
function startGame(){
 if(!world)return;
 clearCharacters();
 const mode=$('mode').value,difficulty=$('difficulty').value,loadout=$('loadout').value;
 bloodEffects?.clear();actionVisuals?.clear();audioSystem?.reset();
 if(bloodEffects)bloodEffects.settings.blood=$('blood-mode').value;
 configureSound($('audio-mode').value==='on',false);
 if(soundEnabled)void audioSystem?.unlock().catch(e=>console.warn('[Hissrum audio]',e));
 game=new Game(world,{
   seed:42,team:'analysts',difficulty,
   config:{mode,difficulty,loadout,firefight:false,
     wanderers:$('dwarf-mode').value==='on',
     botFlight:$('bot-flight-mode').value==='on',
     tacticalAI:true, // GLB cover, flanks and observed-squad coordination
     friendlyFire:false,
     buyTime:2,startMoney:4900,roundTime:150,matchWins:5,
     respawnDelay:2.7,spawnProtection:1.4,botSpeed:3.2,runSpeed:4.6}
 });
 game.start('analysts');
 if(mode==='classic')game.buy(loadout);
 game.pause(false);
 lookYaw=game.player.yaw;lookPitch=.095;game.player.pitch=lookPitch;
 clearScope();syncSpecialHUD();
 currentPhase='';currentWeapon='';
 active=true;paused=false;keys.clear();fire=false;touchFire=false;interact=false;
 currentWeapon='';activeViewModel=null;weaponShotAt=-Infinity;
 setHidden('menu',true);setHidden('pause',true);
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
 paused=true;game.pause(true);audioSystem?.reset();keys.clear();fire=false;touchFire=false;interact=false;touchDescend=false;
 clearScope();
 setHidden('pause',false);setHidden('touch-controls',true);
 if(document.pointerLockElement===canvas)document.exitPointerLock();
}
function resumeGame(){
 if(!game||!active)return;
 paused=false;game.pause(false);setHidden('pause',true);
 if(soundEnabled)void audioSystem?.unlock().catch(e=>console.warn('[Hissrum audio]',e));
 setHidden('touch-controls',!coarse);
 lastFrame=performance.now();
 if(!coarse)requestLock();
}
function mainMenu(){
 active=false;paused=false;if(game)game.pause(true);
 audioSystem?.reset();bloodEffects?.clear();actionVisuals?.clear();
 clearScope();
 game=null;clearCharacters();keys.clear();fire=false;touchFire=false;touchDescend=false;
 setHidden('pause',true);setHidden('match-end',true);setHidden('hud',true);
 setHidden('touch-controls',true);setHidden('menu',false);
 if(activeViewModel)activeViewModel.visible=false;
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
 const events=game.drainEvents();
 actionVisuals?.events(events,game);
 bloodEffects?.handle(events,game);
 if(audioSystem){
   const p=game.player;
   // Positional sound is heard from the real miniature character's EYE,
   // not its feet intersecting the room floor.
   audioSystem.handle(events,p?{...p,y:p.y+p.height-.13}:null,game.state.time);
 }
 for(const event of events){
   if(event.type==='tracer'&&event.from&&event.to)showTracer(event);
   if(event.type==='kill')addKill(event);
   if(event.type==='combat-hit'&&event.actorId===game.player.id)hitUntil=performance.now()+170;
   if(event.type==='damage'&&event.actorId===game.player.id)damageUntil=performance.now()+220;
   if(event.type==='shot'&&event.actorId===game.player.id){shotUntil=performance.now()+75;gunKick=.085;weaponShotAt=game.state.time;}
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
 const deathWatch=watchingPlayerDeath();
 spectateActor=deathWatch?p:(p.alive?p:game.spectator);
 const a=spectateActor||p;
 if(deathWatch){
   // Cartridge Strike's authored third-person death, briefly visible before
   // switching to a surviving teammate. Keep collision/game state unchanged.
   const age=Math.max(0,deathAge(p,game.state.time));
   const zoom=1.25+Math.min(1,age/.85)*.85;
   const angle=(p.yaw||0)+Math.PI*.62;
   const target={x:p.x,y:p.y+.70,z:p.z};
   camera.position.set(
     target.x+Math.sin(angle)*zoom,
     target.y+1.10+Math.min(.45,age*.28),
     target.z+Math.cos(angle)*zoom);
   camera.lookAt(target.x,target.y,target.z);
 }else{
   if(a.isPlayer)camera.rotation.set(a.pitch,a.yaw,0,'YXZ');
   else camera.rotation.set(a.pitch||0,a.yaw||0,0,'YXZ');
   const bob=p.alive&&p.moving>.2&&!p.crouching
     ?Math.sin(game.state.time*12)*Math.min(.032,p.moving*.008):0;
   camera.position.set(a.x,a.y+a.height-.13+bob,a.z);
 }
 const scopeActive=p.alive&&p.weapon==='sniper'&&aiming;
 const desiredFov=scopeActive?19:(coarse?84:76);
 if(Math.abs(camera.fov-desiredFov)>.02){
   camera.fov+=(desiredFov-camera.fov)*Math.min(1,dt*13);
   camera.updateProjectionMatrix();
 }
 setHidden('scope-overlay',!scopeActive);
 document.body.classList.toggle('sniper-scoped',scopeActive);
 gunKick=Math.max(0,gunKick-dt*.45);
 if(p.alive && (p.weapon!==currentWeapon||!activeViewModel)){
   if(activeViewModel)activeViewModel.visible=false;
   let model=weaponModels.get(p.weapon);
   if(!model){
     model=createStrikeViewWeapon(p.weapon||'p9');
     weaponModels.set(p.weapon,model);weaponScene.add(model);
   }
   currentWeapon=p.weapon;activeViewModel=model;
   weaponSwitchAt=game.state.time;
 }
 if(activeViewModel){
   activeViewModel.visible=p.alive&&!scopeActive;
   if(activeViewModel.visible){
     const pose=animateStrikeViewWeapon(activeViewModel,p,game.state.time,dt,{
       shotAt:weaponShotAt,switchAt:weaponSwitchAt,recoil:gunKick,
       reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches
     });
     muzzle.position.copy(pose.muzzle);
   }
 }
 muzzle.visible=!!activeViewModel?.visible&&performance.now()<shotUntil;
}
function activeInput(){
 const p=game?.player;
 return {yaw:lookYaw,pitch:lookPitch,
  forward:clamp((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+touchForward,-1,1),
  strafe:clamp((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchStrafe,-1,1),
  sneak:keys.has('ShiftLeft')||keys.has('ShiftRight'),
  crouch:keys.has('ControlLeft')||keys.has('ControlRight')||touchDescend,
  jump:keys.has('Space')||touchJump,
  fire:fire||touchFire,
  interact:keys.has('KeyE')||interact
 };
}
function paintMapBackground(){
 const c=document.createElement('canvas');c.width=c.height=190;
 const ctx=c.getContext('2d'),b=world.bounds;
 const width=b.max.x-b.min.x,depth=b.max.z-b.min.z;
 ctx.fillStyle='#08222a';ctx.fillRect(0,0,190,190);
 ctx.fillStyle='#34545d';
 const step=world.navigation.spacing;
 for(const n of world.navigation.nodes){
   const x=8+(n.x-b.min.x)/width*174,y=8+(n.z-b.min.z)/depth*174;
   ctx.fillRect(x,y,Math.max(1,step/width*174),Math.max(1,step/depth*174));
 }
 // Real GLB furniture footprints — the map now has recognizable structure.
 ctx.globalAlpha=.96;
 for(const o of world.landmarks){
   const x=8+(o.min.x-b.min.x)/width*174,y=8+(o.min.z-b.min.z)/depth*174;
   const ww=Math.max(1.5,(o.max.x-o.min.x)/width*174);
   const hh=Math.max(1.5,(o.max.z-o.min.z)/depth*174);
   ctx.fillStyle=/CREFORM/i.test(o.name)?'#62e0e6':
     /EUR-pall|kartong/i.test(o.name)?'#deb577':
     /sopkärl|Torr-is/i.test(o.name)?'#929da5':'#a6bfac';
   ctx.fillRect(x,y,ww,hh);
   if(/CREFORM/i.test(o.name)){ctx.strokeStyle='#f2ffff';ctx.lineWidth=.7;ctx.strokeRect(x,y,ww,hh);}
 }
 ctx.globalAlpha=1;
 ctx.strokeStyle='#9dc3c9';ctx.lineWidth=1.8;ctx.strokeRect(7.5,7.5,175,175);
 ctx.font='bold 9px sans-serif';ctx.fillStyle='#ebf5f3';
 ctx.fillText('HISS 12',75,17);
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
 // Halo around actual airborne AI contacts, never a fabricated map position.
 for(const a of game.actors)if(a.alive&&a.bot&&a.flying){
   const [x,y]=xy(a);
   ctx.beginPath();ctx.strokeStyle='#f7f4c0';ctx.lineWidth=1.3;
   ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();
 }
 if(game.config.wanderers)for(const d of game.state.wanderers||[])if(d.alive)dot(d,'#e9bc72',2);
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
 $('reload-hint').textContent=p.reloadUntil>s.time?'LADDAR OM':
   p.weapon==='sniper'?'Z / SIKTE · R LADDA':'R · LADDA OM';
 syncSpecialHUD();
 $('health').style.color=p.hp<30?'#ff9584':'#f5fcfc';
 if(world.landmarks.length){
   let nearest=null,best=Infinity;
   for(const prop of world.landmarks){
     const d=Math.hypot(prop.x-p.x,prop.z-p.z);
     if(d<best){nearest=prop;best=d;}
   }
   $('nearby-label').textContent=nearest
      ?(best<MINIATURE_SCALE*2.2?'NÄRA · ':'MOT · ')+nearest.name.replace(/ · kopia.*$/,'').slice(0,26)
      :'HISSRUM 12';
 }
 $('mission').textContent=s.mode==='endless'?(coarse?'HISSRUM 12 · MINI 5V5':'5 MOT 5 · MINIATYRSTRID I HISSRUM 12'):
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
   // Lightweight thrust puffs make autonomous bot takeoffs visibly obvious.
   // Max four flyers, capped instanced puff pool, and throttled to 6Hz each.
   if(actionVisuals)for(const bot of game.actors){
     if(!bot.bot||!bot.alive||!bot.flying)continue;
     if(game.state.time-(bot.lastFlyTrailAt??-Infinity)<.16)continue;
     bot.lastFlyTrailAt=game.state.time;
     actionVisuals.particle({x:bot.x,y:bot.y+.13,z:bot.z},game.state.time,{
       size:.085,duration:.36,velocity:[0,-.35,0],
       colour:bot.team==='analysts'?0x8ffff3:0xffba7b
     });
   }
   actionVisuals?.update(game,camera);
   bloodEffects?.update(game.state.time,dt,camera);
   if(now-lastHud>100){refreshHUD(now);lastHud=now;}
 }else{
   if(world&&!game){
     const b=world.bounds,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2;
     camera.position.set(cx+3,MINIATURE_SCALE*2.15,cz+(b.max.z-b.min.z)*.43);
     const feature=world.landmarks.find(o=>/CREFORM-vagn 900/i.test(o.name))
       ||world.landmarks.find(o=>/CREFORM/i.test(o.name));
     camera.lookAt(feature?.x??cx,MINIATURE_SCALE*.7,feature?.z??cz);
   }
 }
 for(const t of tracers)if(t.until<now)t.line.visible=false;
 renderer.render(scene,camera);
 if(activeViewModel?.visible){
   renderer.autoClear=false;
   renderer.clearDepth();
   renderer.render(weaponScene,weaponCamera);
   renderer.autoClear=true;
 }
}

window.addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(active&&!paused)pauseGame();return;}
 if(!game||!active||paused||e.repeat)return;
 if(e.code==='KeyR')game.reload();
 if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4')game.select(e.code.at(-1));
 if(e.code==='KeyQ')game.select('last');
 if(e.code==='KeyF')toggleFlight();
 if(e.code==='KeyM')toggleSound();
 if(e.code==='KeyZ')setScope(!aiming);
 if(e.code==='KeyB'&&game.config.mode==='classic'){const result=game.buy($('loadout').value);notice(result.ok?'VAPEN KÖPT':result.reason);}
 if(e.code==='KeyP')pauseGame();
 keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseGame();});
canvas.addEventListener('mousedown',e=>{
 if(!active||paused)return;
 if(e.button===0)fire=true;
 if(e.button===2)setScope(true);
 if(!coarse&&document.pointerLockElement!==canvas)requestLock();
});
window.addEventListener('mouseup',e=>{if(e.button===0)fire=false;if(e.button===2)setScope(false);});
window.addEventListener('blur',()=>{keys.clear();fire=false;touchFire=false;touchDescend=false;if(active)pauseGame();});
document.addEventListener('mousemove',e=>{
 if(!active||paused||document.pointerLockElement!==canvas)return;
 // Acquiring Pointer Lock can synthesize a huge cursor-warp delta. Ignore
 // that single start impulse so the player still faces the real CREFORM aisle.
 if(performance.now()-pointerLockedAt<280 ||
   Math.abs(e.movementX)>180 || Math.abs(e.movementY)>180)return;
 const sense=settings.sensitivity*(aiming?.48:1);
 lookYaw-=e.movementX*sense;
 lookPitch=clamp(lookPitch-e.movementY*sense,-1.48,1.48);
});
document.addEventListener('pointerlockchange',()=>{
 if(document.pointerLockElement===canvas)pointerLockedAt=performance.now();
 else if(active&&!paused&&!coarse)pauseGame();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function setupTouch(){
 const pad=$('move-pad'),stick=$('move-stick'),look=$('look-zone');
 let movePointer=null,lookPointer=null,lookX=0,lookY=0;
 function padMove(e){
   const rect=pad.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
   const x=clamp((e.clientX-cx)/45,-1,1),y=clamp((e.clientY-cy)/45,-1,1);
   const len=Math.hypot(x,y),f=len>1?1/len:1;
   touchStrafe=x*f;touchForward=-y*f;
   stick.style.transform='translate('+touchStrafe*38+'px,'+(-touchForward)*38+'px)';
 }
 pad.addEventListener('pointerdown',e=>{e.preventDefault();movePointer=e.pointerId;pad.setPointerCapture(movePointer);padMove(e);});
 pad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)padMove(e);});
 function resetPad(e){if(e.pointerId!==movePointer)return;movePointer=null;touchStrafe=touchForward=0;stick.style.transform='translate(0,0)';}
 pad.addEventListener('pointerup',resetPad);pad.addEventListener('pointercancel',resetPad);
 look.addEventListener('pointerdown',e=>{e.preventDefault();lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture(lookPointer);});
 look.addEventListener('pointermove',e=>{
   if(e.pointerId!==lookPointer||!active||paused)return;
   const sense=settings.mobileSensitivity*(aiming?.46:1);
   lookYaw-=(e.clientX-lookX)*sense;
   lookPitch=clamp(lookPitch-(e.clientY-lookY)*sense,-1.48,1.48);
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
     if(action==='descend')touchDescend=true;
     if(action==='interact')interact=true;
     if(action==='fly')toggleFlight();
     if(action==='scope')setScope(!aiming);
     if(action==='reload')game?.reload();
     if(action==='switch')game?.select('last');
   });
   const reset=()=>{
     if(action==='fire')touchFire=false;
     if(action==='jump')touchJump=false;
     if(action==='descend')touchDescend=false;
     if(action==='interact')interact=false;
   };
   button.addEventListener('pointerup',reset);button.addEventListener('pointercancel',reset);
 }
}
$('start').addEventListener('click',startGame);
$('sound-button').addEventListener('click',toggleSound);
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
 // Load the copied CC0 Cartridge Strike GLBs before allowing any match.
 progress('Laddar Cartridge Strike-karaktärer och animationsriggar…');
 const [room]=await Promise.all([createHissrumWorld(progress),loadCharacterLibrary()]);
 world=room;
 modelRoot=world.model;scene.add(modelRoot);
 installRoomLighting();
 mapBackdrop=paintMapBackground();
 actionVisuals=new ActionVisuals(scene,world);
 bloodEffects=new CombatEffects(scene,world,{blood:'standard'});
 audioSystem=new AudioSystem(world,{volume:.55,ambient:true});
 if(coarse)$('blood-mode').value='reduced'; // preserve iPhone GPU budget
 configureSound(true,false);
 if(new URLSearchParams(location.search).has('test')){
   window.__hissrumDiagnostics=()=>({
     scale:MINIATURE_SCALE,roomHeight:world.bounds.max.y,
     floorReference:world.statistics.floorReference,
     player:game?{x:game.player.x,y:game.player.y,z:game.player.z,yaw:game.player.yaw,eye:camera.position.y}:null,
     camera:{position:camera.position.toArray(),forward:camera.getWorldDirection(new THREE.Vector3()).toArray()},
     anchors:world.anchors,
     namedProps:world.landmarks.map(o=>({name:o.name,x:o.x,y:o.y,z:o.z,
       ndc:new THREE.Vector3(o.x,o.y,o.z).project(camera).toArray()})),
     stats:world.statistics,
     characterModelReady:charactersReady(),
     authoredVisuals:[...actors.values(),...hostages.values()].filter(v=>v.userData.renderType==='cartridge-strike-quaternius').length,
     deathAnimations:[...actors.values()].filter(v=>!!v.userData.avatar?.death).length,
     playerDeathCamera:!!watchingPlayerDeath(),
     weaponModel:activeViewModel?.userData?.id??null,
     viewmodelSource:activeViewModel?.userData?.hissrumSource??null,
     viewmodelType:activeViewModel?.userData?.originalStrikeKit?'skinned-hands':'fitted-gloves',
     viewmodelSkinnedHands:activeViewModel?.getObjectByName('kit-skinned-glove')?.isSkinnedMesh===true,
     spawnSpread:game?.actors?.length?
       Math.min(...game.actors.flatMap((a,i)=>game.actors.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z)))):null,
     flying:!!game?.player?.flying,scopeActive:!!(game?.player?.weapon==='sniper'&&aiming),
     fov:camera.fov,tapeCollidersExcluded:world.statistics.nonSolidTapeMeshes,
     dwarfCount:game?.state.wanderers?.length||0,
     visibleDwarfs:actionVisuals?.dwarfs?.size||0,
     flyingBots:game?.actors?.filter(a=>a.bot&&a.alive&&a.flying).length||0,
     botFlightEnabled:!!game?.config.botFlight,
     tacticalAIEnabled:!!game?.config.tacticalAI,
     tacticalBots:game?.actors?.filter(a=>a.bot&&a.alive).map(a=>({
       id:a.id,aiState:a.aiState||'',mode:a.bot?.mode||'',
       tactic:a.bot?.tactical?.kind||null,
       hasTarget:!!a.bot?.target?.visible,
       usingObservedContact:!!a.bot?.sharedContact,
       flying:!!a.flying,
       goal:a.bot?.goal?{x:a.bot.goal.x,z:a.bot.goal.z}:null
     }))||[],
     bloodHits:bloodEffects?.stats.blood||0,
     bloodSetting:bloodEffects?.settings.blood,
     soundEnabled,audioActive:audioSystem?.context?.state==='running',
     decodedSounds:audioSystem?.buffers.size||0,
     audioErrors:audioSystem?.errors.slice(0,3)||[]
   });
   // Read-only visual QA plus a controlled hit on a synthetic event, available
   // ONLY when ?test is explicitly present. Never mutates a player's HP.
   window.__hissrumVisualTest={
     paintDamage:()=>{
       if(!game||!bloodEffects)return false;
       const target=game.actors.find(a=>a.alive&&!a.isPlayer);
       if(!target)return false;
       const event={type:'damage',serial:100000000+Math.floor(game.state.time*100),
         amount:19,hp:52,actorId:target.id,sourceId:game.player.id,
         point:{x:target.x,y:target.y+target.height*.72,z:target.z},
         direction:{x:.7,y:.1,z:.2}};
       bloodEffects.handle([event],game);
       return bloodEffects.stats.blood>0;
     },
     previewSound:()=>{
       if(!game||!audioSystem)return false;
       audioSystem.handle([{type:'shot',serial:999001,actorId:game.player.id,
         team:game.player.team,weapon:'ar47',time:game.state.time,
         x:game.player.x,y:game.player.y+1.5,z:game.player.z}],
         {...game.player,y:game.player.y+1.5},game.state.time);
       return audioSystem.stats.played>0;
     }
   };
 }
 setHidden('loading',true);
 $('start').disabled=false;$('start').textContent='STARTA MINI-MATCH';
}catch(error){
 console.error('[Hissrum Strike] Could not initialize model or navigation',error);
 progress('Kunde inte öppna spelplanen: '+(error?.message||String(error))+'. Öppna via en lokal HTTP-server eller GitHub Pages.');
 $('loading').classList.add('failed');
}
