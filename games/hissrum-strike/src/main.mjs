import {readPreferences,writePreferences,sanitizePreferences,pixelRatioFor,baseFov,shouldRender} from './player-preferences.mjs';
import {lifeReadout} from './life-readout.mjs';
import * as THREE from 'three';
import {createHissrumWorld,MINIATURE_SCALE} from './world.mjs?v=hissrum-effects-v4';
import {Game,WEAPONS} from './fps/game.mjs?v=cartridge-tank-v9';
import {AudioSystem} from './audio.mjs?v=cartridge-tank-v9';
import {CombatEffects} from './effects.mjs';
import {ActionVisuals} from './action-visuals.mjs';
import {isAutoFireWeapon,resetAutoAim} from './fps/aim-controls.mjs?v=cartridge-tank-v9';
import {GrenadeView} from './grenade-view.mjs';
import {bindTouchControls} from './touch-controls.mjs';
import {createGameViewportSync} from './viewport-sync.mjs';
import {KillFeedView,drawPlayerHeading} from './hud-polish.mjs';
import {CartridgeTankView} from './tank-view.mjs';
import {TANK,drivingTank,nearTank,toggleTank,tankFits} from './fps/cartridge-tank.mjs';
import {deathMotion} from './characters/death-motion.mjs';
import {CombatHUD} from './combat-hud.mjs?v=combat-hud-v8';
import {loadCharacterLibrary,charactersReady,createAuthoredAvatar,animateAuthored,disposeAvatar,posedBounds} from './characters/character-library.mjs';
import {createStrikeViewWeapon,animateStrikeViewWeapon} from './weapon-kit/weapon-view.mjs';
import {makeWeapon as createStrikeWorldWeapon} from './weapon-kit/model-primitives.mjs';
import {corpseShouldShow,deathAge,poseAuthoredDeath,resumeAuthoredAfterRespawn,
  PLAYER_DEATH_CAMERA_SECONDS} from './characters/death-animation.mjs?v=cartridge-tank-v9';

const $=id=>document.getElementById(id);
const canvas=$('scene'),coarse=matchMedia('(pointer:coarse)').matches;
const reducedMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const killFeedView=new KillFeedView($('killfeed'));
let touchControls=null;
let preferences=readPreferences(null);
try{preferences=readPreferences(localStorage);}catch{}
let lastRender=-Infinity;
const keys=new Set(),actors=new Map(),hostages=new Map();
const settings={sensitivity:.0021,mobileSensitivity:.0065,autoFire:true,trajectory:true,allyMarkers:true,combatFeedback:true};
try{settings.autoFire=localStorage.getItem('hissrum.autoFire')!=='off';settings.trajectory=localStorage.getItem('hissrum.trajectory')!=='off';}catch{}
try{settings.allyMarkers=localStorage.getItem('hissrum.allyMarkers')!=='off';settings.combatFeedback=localStorage.getItem('hissrum.combatFeedback')!=='off';}catch{}
let tankView=null;
let shopOpen=false,grenadeView=null,combatHUD=null,scoreOpen=false,scoreReturn='game';
let scene,renderer,camera,world,game,modelRoot,weaponScene,weaponCamera,weaponStage,weaponModels=new Map(),activeViewModel,muzzle,gunKick=0,shotUntil=0,weaponShotAt=-Infinity,weaponSwitchAt=0;
let active=false,paused=false,lookYaw=0,lookPitch=0,fire=false,interact=false,touchFire=false,touchJump=false,touchDescend=false,aiming=false,touchForward=0,touchStrafe=0;
let mapBackdrop=null,tracers=[],tracerCursor=0,lastFrame=0,lastHud=0,noticeUntil=0,damageUntil=0;
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
  camera=new THREE.PerspectiveCamera(baseFov(preferences,coarse),1,.045,175);
  camera.rotation.order='YXZ';
  renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(pixelRatioFor(preferences.quality,coarse,devicePixelRatio||1));
  // Do not call setSize(innerWidth,innerHeight) here: its default inline
  // canvas width can remain narrower than iPhone Safari's landscape HUD.
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
  const syncViewport=createGameViewportSync({
    canvas,renderer,cameras:[camera,weaponCamera],root:document.documentElement,overlay:$('hud')
  });
  syncViewport();
  // ResizeObserver catches CSS viewport changes even when the browser does
  // not send a window resize (notably iOS landscape and toolbar transitions).
  new ResizeObserver(syncViewport).observe(canvas);
  addEventListener('resize',()=>{
    resetControls(); // prevent stale touch coordinates after actual rotation
    syncViewport();
  });
  window.visualViewport?.addEventListener('resize',syncViewport);
  addEventListener('orientationchange',()=>{
    resetControls();
    requestAnimationFrame(syncViewport);
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)requestAnimationFrame(syncViewport);
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
 if(team!=='hostage'){
   const socket=new THREE.Group();socket.name='cartridge-strike-world-weapon-socket';
   root.userData.weaponSocket=socket;root.userData.worldGuns=new Map();
   root.add(socket);
 }
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
const wristScratch=new THREE.Vector3(),gripScratch=new THREE.Vector3();
function syncOriginalWorldWeapon(visual,actor){
 const socket=visual.userData.weaponSocket;
 if(!socket)return;
 const weapon=WEAPONS[actor.weapon];
 if(!actor.alive||!weapon||!['primary','pistol','knife'].includes(weapon.slot)){
   socket.visible=false;return;
 }
 if(visual.userData.worldWeapon!==actor.weapon){
   for(const item of socket.children)item.visible=false;
   let gun=visual.userData.worldGuns.get(actor.weapon);
   if(!gun){
     gun=createStrikeWorldWeapon(actor.weapon,{viewmodel:false});
     visual.userData.worldGuns.set(actor.weapon,gun);
     socket.add(gun);
   }
   gun.visible=true;visual.userData.worldWeapon=actor.weapon;
 }
 socket.visible=true;
 // Borrow Cartridge Strike's third-person wrist socket calculation. The
 // held gun follows the original animated Quaternius right-hand bone.
 const hand=visual.userData.avatar.bones.get('hand_r');
 if(!hand)return;
 visual.updateWorldMatrix(true,true);
 const wrist=visual.worldToLocal(hand.getWorldPosition(wristScratch));
 const gun=visual.userData.worldGuns.get(actor.weapon);
 socket.rotation.set(Math.max(-.65,Math.min(.65,actor.pitch||0)),0,0);
 gripScratch.copy(gun.userData.grip||gripScratch.set(0,0,0))
   .multiplyScalar(.85).applyEuler(socket.rotation);
 socket.position.copy(wrist).sub(gripScratch);
 socket.position.y-=.012;socket.position.z-=.043;
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
   visual.visible=!actor.vehicleId&&(actor.alive||recentlyDead)
     &&(watchingPlayerDeath()&&actor.isPlayer||shouldRenderAvatar(actor,cameraActor));
   // Even a body currently outside the camera starts the genuine Death01
   // action. This avoids delayed animation when the player turns around.
   if(!visual.visible){
     if(recentlyDead&&!visual.userData.avatar.death)
       poseAuthoredDeath(visual.userData.avatar,actor,game.state.time);
     continue;
   }
   let corpseY=actor.y;
   if(recentlyDead){
     if(visual.userData.corpseAt!==actor.deathAt){
       const floor=world.raycast({x:actor.x,y:actor.y+.02,z:actor.z},{x:0,y:-1,z:0},actor.y+.04,{vision:false});
       visual.userData.corpseFloor=Math.max(0,floor?.point.y||0);visual.userData.corpseAt=actor.deathAt;
     }
     corpseY=Math.max(visual.userData.corpseFloor,actor.y-deathMotion(actor,deathAge(actor,game.state.time)).airDrop);
   }
   visual.position.set(actor.x,corpseY,actor.z);
   visual.rotation.y=actor.yaw;
   // Authored crouch and jump clips handle body pose; do not squash the mesh
   // when Game changes its collision capsule height.
   visual.scale.setScalar(1);
   poseCharacter(visual,actor,game.state.time);
   if(actor.alive)syncOriginalWorldWeapon(visual,actor);
   else if(visual.userData.weaponSocket)visual.userData.weaponSocket.visible=false;
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
  weaponStage=new THREE.Group();
  // Original weapons use 60° view geometry. Portrait displays have a much
  // narrower horizontal FOV: shrink and shift THE CAMERA OVERLAY, not meshes,
  // so full skinned hands stay legible without clipping the real GLB walls.
  if(coarse){weaponStage.scale.setScalar(.72);weaponStage.position.set(-.075,-.045,-.065);}
  weaponScene.add(weaponStage);
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
 aiming=!!value&&!!game?.player?.alive&&!game.player.vehicleId&&game.player.weapon==='sniper';
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
function resetControls(){
 touchControls?.reset();
 keys.clear();fire=false;touchFire=false;touchJump=false;touchDescend=false;interact=false;
 touchForward=0;touchStrafe=0;$('move-stick').style.transform='translate(0,0)';
 if(game?.player){resetAutoAim(game.player);game.player.fireHeld=false;game.player.requireFireRelease=false;}
}
function updateControlSettings(){
 for(const id of ['auto-fire-mode','auto-fire-pause'])$(id).value=settings.autoFire?'auto':'manual';
 for(const id of ['trajectory-mode','trajectory-pause'])$(id).value=settings.trajectory?'on':'off';
 resetControls();if(game)syncSpecialHUD();
}
function updateReadabilitySettings(){
 for(const id of ['ally-marks-mode','ally-marks-pause'])$(id).value=settings.allyMarkers?'on':'off';
 for(const id of ['combat-feedback-mode','combat-feedback-pause'])$(id).value=settings.combatFeedback?'on':'off';
 combatHUD?.hide();
}
function openScoreboard(){
 if(!game||shopOpen||scoreOpen||(!active&&game.phase!=='match'))return;
 scoreReturn=game.phase==='match'?'end':paused?'pause':'game';
 if(active&&!paused)pauseGame();
 scoreOpen=true;setHidden('pause',true);setHidden('match-end',true);
 combatHUD?.renderScoreboard(game);setHidden('scoreboard',false);$('scoreboard-close').focus();
}
function closeScoreboard(){
 if(!scoreOpen)return;
 scoreOpen=false;setHidden('scoreboard',true);
 if(scoreReturn==='end'){setHidden('match-end',false);$('end-stats').focus();}
 else if(scoreReturn==='pause'){setHidden('pause',false);$('resume').focus();}
 else resumeGame();
}
function selectGrenade(){
 if(game?.player?.vehicleId)return;
 if(!game?.player?.alive||!active||paused)return;
 if(!game.select('grenade'))notice('INGA GRANATER · ÖPPNA KÖP / B',2);
 else{clearScope();resetControls();notice('GRANAT VALD · KASTA MED SKJUT / MUS',2);}
 syncSpecialHUD();
}
function openShop(){
 if(game?.player?.vehicleId){notice('LÄMNA FORDONET FÖRE VAPENKÖP');return;}
 if(!active||!game?.player?.alive||!['buy','active'].includes(game.phase))return;
 pauseGame();shopOpen=true;setHidden('pause',true);setHidden('shop',false);
 $('shop-message').textContent='Köp direkt under rundan. 300 krediter per utslagen motståndare.';
 renderShop();$('shop-close').focus();
}
function closeShop(){shopOpen=false;setHidden('shop',true);resumeGame();}
function renderShop(){
 const p=game?.player;if(!p)return;
 $('shop-money').textContent=Math.floor(p.money);const grid=$('shop-items');grid.replaceChildren();
 for(const id of ['smg','ar47','cr4','shotgun','sniper','bazooka','armor','he','flash','smoke']){
  const w=WEAPONS[id];if(!w)continue;
  const b=document.createElement('button');b.type='button';b.className='shop-item';b.dataset.buy=id;
  const owned=w.slot==='primary'&&p.inventory.primary?.id===id;
  const full=w.slot==='armor'&&p.armor>=100||w.slot==='grenade'&&p.inventory[id]>=w.limit;
  b.disabled=owned||full||p.money<w.cost;
  const label=document.createElement('span');label.textContent=w.name;
  const price=document.createElement('small');price.textContent=owned?'UTRUSTAD':full?'FULLT':w.cost+' krediter';
  b.append(label,price);
  b.addEventListener('click',()=>{
    const result=game.buy(id);resetControls();
    $('shop-message').textContent=result.ok?'KÖPT: '+w.name:result.reason;
    renderShop();
  });grid.append(b);
 }
}
function syncSpecialHUD(){
 const p=game?.player;
 setHidden('touch-controls',!coarse||!active||paused||!p?.alive);
 $('crosshair').hidden=!p?.alive;
 const flying=!!p?.alive&&!!p.flying;
 const mounted=!!game&&drivingTank(game,p);
 const sniper=!!p?.alive&&!mounted&&p.weapon==='sniper';
 if(!sniper&&aiming)setScope(false);
 $('flight-status').hidden=!flying;
 $('flight-toggle').classList.toggle('active',flying);
 $('flight-toggle').setAttribute('aria-pressed',String(flying));
 $('flight-toggle').textContent=flying?'LANDA':'FLYG';
 $('jump-button').textContent=flying?'UPP':'HOPPA';
 $('descend-button').hidden=!flying;
 $('scope-toggle').hidden=!sniper;
 if(!flying)touchDescend=false;
 const w=WEAPONS[p?.weapon],automatic=!mounted&&coarse&&settings.autoFire&&isAutoFireWeapon(w);
 const fireButton=document.querySelector('[data-touch="fire"]');
 fireButton.hidden=automatic;
 fireButton.textContent=mounted?'KANON':w?.slot==='grenade'?'KASTA':w?.slot==='knife'?'SLÅ':'SKJUT';
 document.querySelector('.touch-actions').classList.toggle('auto-fire',automatic);
 $('auto-status').hidden=!automatic||!p?.alive;
 const lock=p?.autoAimProgress??0;
 $('auto-status').classList.toggle('locking',p?.weapon==='sniper'&&lock>0);
 $('auto-status').textContent=p?.weapon==='sniper'&&lock>0?'SIKTA · '+Math.round(lock*100)+' %':'AUTO';
 $('grenade-status').hidden=mounted||!(p?.alive&&w?.slot==='grenade');
 const t=game?.state.tank,near=!!game&&nearTank(game,p);
 document.querySelector('[data-touch="interact"]').textContent=mounted?'LÄMNA':near?'KÖR':'E';
 for(const key of ['reload','switch','fly','grenade']){const el=document.querySelector('[data-touch="'+key+'"]');if(el)el.hidden=mounted;}
 $('jump-button').textContent=mounted?'BROMS':flying?'UPP':'HOPPA';
 const status=$('tank-status');status.hidden=!(t&&(mounted||near||!t.alive));
 status.textContent=mounted?'CARTRIDGE · PANSAR '+Math.ceil(t.hp)+' / '+t.maxHp:near?'E / KÖR · CARTRIDGE-PANSARVAGN':t&&!t.alive?'CARTRIDGE ÅTEROM '+Math.max(0,Math.ceil(t.respawnAt-game.state.time))+' s':'';
 document.body.classList.toggle('driving-tank',mounted);
}

function toggleFlight(){
 if(game?.player?.vehicleId)return;
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
 scoreOpen=false;setHidden('scoreboard',true);setHidden('life-card',true);setHidden('spawn-shield',true);combatHUD?.reset();feed.length=0;
 shopOpen=false;setHidden('shop',true);resetControls();grenadeView?.clear();
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
     cartridgeTank:true,
     tacticalAI:true,progressiveRecoil:true,liveShop:true,openArsenal:true,
     agileFlight:true,maxFlyingBots:4,botFlySpeed:4.5,playerGrenadeSpeed:17,
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
 for(const gun of weaponModels.values())gun.visible=false;
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
 resetControls();grenadeView?.update(game,false);combatHUD?.hide();
 paused=true;game.pause(true);audioSystem?.reset();keys.clear();fire=false;touchFire=false;interact=false;touchDescend=false;
 clearScope();
 setHidden('pause',false);setHidden('touch-controls',true);
 if(document.pointerLockElement===canvas)document.exitPointerLock();
}
function resumeGame(){
 if(!game||!active)return;
 resetControls();setHidden('shop',true);shopOpen=false;scoreOpen=false;setHidden('scoreboard',true);
 paused=false;game.pause(false);setHidden('pause',true);
 if(soundEnabled)void audioSystem?.unlock().catch(e=>console.warn('[Hissrum audio]',e));
 setHidden('touch-controls',!coarse);
 lastFrame=performance.now();
 if(!coarse)requestLock();
}
function mainMenu(){
 scoreOpen=false;setHidden('scoreboard',true);setHidden('life-card',true);setHidden('spawn-shield',true);combatHUD?.reset();
 resetControls();shopOpen=false;setHidden('shop',true);grenadeView?.clear();
 active=false;paused=false;if(game)game.pause(true);
 audioSystem?.reset();bloodEffects?.clear();actionVisuals?.clear();
 clearScope();
 game=null;tankView?.update(null);clearCharacters();keys.clear();fire=false;touchFire=false;touchDescend=false;
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
 combatHUD?.handle(events,game);
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
   if(event.type==='respawn'&&event.actorId===game.player.id){
     lookYaw=game.player.rawAimYaw??game.player.yaw;lookPitch=0;resetControls();clearScope();
   }
   if(event.type==='throw'&&event.actorId===game.player.id){fire=false;touchFire=false;}

   if(event.type==='tank-enter'||event.type==='tank-exit'){clearScope();resetControls();syncSpecialHUD();notice(event.type==='tank-enter'?'CARTRIDGE · W/S KÖR · A/D SVÄNG · MUS/SVEP SIKTA':'DU HAR LÄMNAT FORDONET');}
   if(event.type==='tank-destroyed')notice('CARTRIDGE FÖRSTÖRD · ÅTERKOMMER PÅ STARTPLATSEN',3);
   if(event.type==='tank-exit-blocked')notice('UTGÅNGEN BLOCKERAD · FLYTTA BILEN');
   if(event.type==='kill'){addKill(event);if(event.actorId===game.player.id)resetControls();}
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
   const target={x:p.x,y:(actors.get(p.id)?.position.y??p.y)+.70,z:p.z};
   camera.position.set(
     target.x+Math.sin(angle)*zoom,
     target.y+1.10+Math.min(.45,age*.28),
     target.z+Math.cos(angle)*zoom);
   const offset=camera.position.clone().sub(new THREE.Vector3(target.x,target.y,target.z));
   const d=offset.length();offset.normalize();const obstruction=world.raycast(target,offset,d,{vision:false});
   if(obstruction)camera.position.set(target.x,target.y,target.z).addScaledVector(offset,Math.max(.3,obstruction.distance-.15));
   camera.lookAt(target.x,target.y,target.z);
 }else if(drivingTank(game,p)){
   const t=game.state.tank,dir={x:-Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*Math.cos(p.pitch)};
   const pivot=new THREE.Vector3(t.x,1.5,t.z);
   const wish=new THREE.Vector3(t.x-dir.x*4.4,3.5-dir.y*2,t.z-dir.z*4.4);
   const offset=wish.clone().sub(pivot),len=offset.length();offset.normalize();
   const wall=world.raycast(pivot,offset,len,{vision:false});
   camera.position.copy(pivot).addScaledVector(offset,wall?Math.max(.4,wall.distance-.18):len);
   camera.lookAt(t.x+dir.x*32,1.5+dir.y*32,t.z+dir.z*32);
 }else{
   if(a.isPlayer)camera.rotation.set(a.pitch,a.yaw,0,'YXZ');
   else camera.rotation.set(a.pitch||0,a.yaw||0,0,'YXZ');
   // Crosshair and authoritative bullet origin coincide, including recoil.
   camera.position.set(a.x,a.y+a.height-.12,a.z);
 }
 const scopeActive=p.alive&&!p.vehicleId&&p.weapon==='sniper'&&aiming;
 const desiredFov=scopeActive?19:baseFov(preferences,coarse);
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
     weaponModels.set(p.weapon,model);weaponStage.add(model);
   }
   currentWeapon=p.weapon;activeViewModel=model;
   weaponSwitchAt=game.state.time;
 }
 if(activeViewModel){
   activeViewModel.visible=p.alive&&!p.vehicleId&&!scopeActive;
   if(activeViewModel.visible){
     const pose=animateStrikeViewWeapon(activeViewModel,p,game.state.time,dt,{
       shotAt:weaponShotAt,switchAt:weaponSwitchAt,recoil:gunKick,
       reducedMotion:preferences.motion==='reduced'||reducedMotionQuery.matches
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
  fire:coarse?touchFire:fire,
  autoFire:coarse&&settings.autoFire&&!paused&&!shopOpen,
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
 const t=game.state.tank;if(t){const [x,y]=xy(t.alive?t:t.home);ctx.fillStyle=t.alive?'#ffe589':'#978d82';ctx.fillRect(x-3,y-3,6,6);}
 if(game.player.alive){
   const a=game.player,[x,y]=xy(a);
   ctx.fillStyle='#fff';drawPlayerHeading(ctx,x,y,a.yaw);
 }
}
function renderFeed(now){
 while(feed.length&&feed[feed.length-1].until<now)feed.pop();
 killFeedView.render(feed);
}
function updateLifeHUD(){
 const info=lifeReadout(game,WEAPONS);
 setHidden('life-card',info.kind!=='death');setHidden('spawn-shield',info.kind!=='protection');
 if(info.kind==='death'){
   $('life-title').textContent=info.title;$('life-detail').textContent=info.detail;
   $('life-next').textContent=info.next;$('life-progress').style.transform=`scaleX(${info.progress})`;
 }else if(info.kind==='protection')$('spawn-shield').textContent=info.title+' · skjut för att avbryta';
}
function setupPreferences(){
 const sync=()=>{
   for(const input of document.querySelectorAll('[data-preference]')){
     const key=input.dataset.preference;input.value=preferences[key];
     const output=input.parentElement.querySelector('output');
     if(output)output.textContent=key==='sensitivity'?preferences[key].toFixed(2)+'×':preferences[key]+'°';
   }
 };
 for(const input of document.querySelectorAll('[data-preference]'))input.addEventListener('input',()=>{
   preferences=sanitizePreferences({...preferences,[input.dataset.preference]:input.value});
   try{writePreferences(localStorage,preferences);}catch{}
   sync();
   if(input.dataset.preference==='quality'&&renderer){
     renderer.setPixelRatio(pixelRatioFor(preferences.quality,coarse,devicePixelRatio||1));
   }
 });
 for(const button of document.querySelectorAll('[data-reset-preferences]'))button.addEventListener('click',()=>{
   preferences=sanitizePreferences({});preferences.fov=coarse?84:76;
   try{writePreferences(localStorage,preferences);}catch{}sync();
   renderer?.setPixelRatio(pixelRatioFor(preferences.quality,coarse,devicePixelRatio||1));
 });
 // A saved zero means use this device's original field of view.
 if(!preferences.fov)preferences.fov=coarse?84:76;
 sync();
}
function refreshHUD(now){
 if(!game)return;
 const s=game.state,p=game.player;
 updateLifeHUD();
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
 if(drivingTank(game,p)){
   const t=game.state.tank;const left=Math.max(0,t.nextShot-s.time);
   $('weapon').textContent='CARTRIDGE-KANON';$('ammo').textContent='∞';$('reserve').textContent='';
   $('reload-hint').textContent=left>0?'KANON LADDAR · '+left.toFixed(1)+' s':'REDO · E / LÄMNA';
 }
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
 if(!p.alive)$('spectate-name').textContent=watchingPlayerDeath()?'DÖDSVY':(game.spectator?.name||'LAGKAMRAT');
 $('notify').style.opacity=now<noticeUntil?'1':'0';
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
 if(!shouldRender(now,lastRender,!!(game&&active&&!paused),document.hidden)){lastFrame=now;return;}
 lastRender=now;
 const dt=Math.min(.05,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
 if(game&&active&&!paused){
   if(game.phase!=='match')game.update(dt,activeInput());
   updateEvents();syncCharacters(dt);cameraFollow(dt);
   grenadeView?.update(game,settings.trajectory);
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
   tankView?.update(game);
   if(now-lastHud>100){refreshHUD(now);lastHud=now;}
   combatHUD?.update(game,camera,{enabled:active&&!paused,markers:settings.allyMarkers,
     feedback:settings.combatFeedback,scope:aiming,weapon:game.player.vehicleId?null:WEAPONS[game.player.weapon]});
 }else{
   combatHUD?.hide();
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
 if(e.code==='Tab'&&game&&((active&&!paused)||scoreOpen)){
   e.preventDefault();if(!e.repeat){if(scoreOpen)closeScoreboard();else openScoreboard();}return;
 }
 if(active&&!paused&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(scoreOpen)closeScoreboard();else if(shopOpen)closeShop();else if(active&&!paused)pauseGame();return;}
 if(!game||!active||paused||e.repeat)return;
 if(e.code==='KeyR')game.reload();
 if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4')game.select(e.code.at(-1));
 if(e.code==='KeyQ')game.select('last');
 if(e.code==='KeyF')toggleFlight();
 if(e.code==='KeyM')toggleSound();
 if(e.code==='KeyZ')setScope(!aiming);
 if(e.code==='KeyB'){e.preventDefault();openShop();return;}
 if(e.code==='KeyG'){e.preventDefault();selectGrenade();return;}
 if(e.code==='KeyP')pauseGame();
 keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseGame();});
canvas.addEventListener('mousedown',e=>{
 if(!active||paused||coarse)return;
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
 const sense=settings.sensitivity*preferences.sensitivity*(aiming?.48:1);
 lookYaw-=e.movementX*sense;
 lookPitch=clamp(lookPitch-e.movementY*sense,-1.48,1.48);
});
document.addEventListener('pointerlockchange',()=>{
 if(document.pointerLockElement===canvas)pointerLockedAt=performance.now();
 else if(active&&!paused&&!coarse)pauseGame();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function setupTouch(){
 touchControls=bindTouchControls({
   pad:$('move-pad'),stick:$('move-stick'),look:$('look-zone'),
   buttons:document.querySelectorAll('[data-touch]'),
   enabled:()=>active&&!paused&&!shopOpen&&!scoreOpen,
   onMove:(strafe,forward)=>{touchStrafe=strafe;touchForward=forward;},
   onLook:(dx,dy)=>{
     const sense=settings.mobileSensitivity*preferences.sensitivity*(aiming?.46:1);
     lookYaw-=dx*sense;lookPitch=clamp(lookPitch-dy*sense,-1.48,1.48);
   },
   onPress:action=>{
     if(action==='fire')touchFire=true;
     if(action==='grenade')selectGrenade();
     if(action==='jump')touchJump=true;
     if(action==='descend')touchDescend=true;
     if(action==='interact'){
       if(game&&(drivingTank(game)||nearTank(game))){toggleTank(game);clearScope();resetControls();syncSpecialHUD();}
       else interact=true;
     }
     if(action==='fly')toggleFlight();
     if(action==='scope')setScope(!aiming);
     if(action==='reload')game?.reload();
     if(action==='switch')game?.select('last');
   },
   onRelease:action=>{
     if(action==='fire')touchFire=false;
     if(action==='jump')touchJump=false;
     if(action==='descend')touchDescend=false;
     if(action==='interact')interact=false;
   }
 });
}

$('scoreboard-button').addEventListener('click',openScoreboard);
$('end-stats').addEventListener('click',openScoreboard);
$('scoreboard-close').addEventListener('click',closeScoreboard);
for(const id of ['ally-marks-mode','ally-marks-pause'])$(id).addEventListener('change',e=>{
 settings.allyMarkers=e.target.value==='on';try{localStorage.setItem('hissrum.allyMarkers',settings.allyMarkers?'on':'off');}catch{}
 updateReadabilitySettings();
});
for(const id of ['combat-feedback-mode','combat-feedback-pause'])$(id).addEventListener('change',e=>{
 settings.combatFeedback=e.target.value==='on';try{localStorage.setItem('hissrum.combatFeedback',settings.combatFeedback?'on':'off');}catch{}
 updateReadabilitySettings();
});
updateReadabilitySettings();
$('shop-button').addEventListener('click',openShop);
$('shop-close').addEventListener('click',closeShop);
for(const id of ['auto-fire-mode','auto-fire-pause'])$(id).addEventListener('change',e=>{
 settings.autoFire=e.target.value==='auto';
 try{localStorage.setItem('hissrum.autoFire',settings.autoFire?'on':'off');}catch{}
 updateControlSettings();
});
for(const id of ['trajectory-mode','trajectory-pause'])$(id).addEventListener('change',e=>{
 settings.trajectory=e.target.value==='on';
 try{localStorage.setItem('hissrum.trajectory',settings.trajectory?'on':'off');}catch{}
 updateControlSettings();
});
updateControlSettings();
$('start').addEventListener('click',startGame);
$('sound-button').addEventListener('click',toggleSound);
$('pause-button').addEventListener('click',pauseGame);
$('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',startGame);
$('back-menu').addEventListener('click',mainMenu);
$('play-again').addEventListener('click',startGame);
$('end-menu').addEventListener('click',mainMenu);
setupTouch();
setupPreferences();
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
 grenadeView=new GrenadeView(scene,world);
 tankView=new CartridgeTankView(scene);
 bloodEffects=new CombatEffects(scene,world,{blood:'standard'});
 audioSystem=new AudioSystem(world,{volume:.55,ambient:true});
 combatHUD=new CombatHUD(document);
 if(coarse)$('blood-mode').value='reduced'; // preserve iPhone GPU budget
 configureSound(true,false);
 if(new URLSearchParams(location.search).has('test')){
   window.__hissrumDiagnostics=()=>({
     scale:MINIATURE_SCALE,roomHeight:world.bounds.max.y,
     preferences:{...preferences},renderCalls:renderer.info.render.frame,
     floorReference:world.statistics.floorReference,
     player:game?{x:game.player.x,y:game.player.y,z:game.player.z,yaw:game.player.yaw,eye:camera.position.y}:null,
     camera:{position:camera.position.toArray(),forward:camera.getWorldDirection(new THREE.Vector3()).toArray()},
     anchors:world.anchors,
     namedProps:world.landmarks.map(o=>({name:o.name,x:o.x,y:o.y,z:o.z,
       ndc:new THREE.Vector3(o.x,o.y,o.z).project(camera).toArray()})),
     stats:world.statistics,
     characterModelReady:charactersReady(),
     authoredVisuals:[...actors.values(),...hostages.values()].filter(v=>v.userData.renderType==='cartridge-strike-quaternius').length,
     tank:game?.state.tank?{...game.state.tank,home:{...game.state.tank.home},shells:game.state.tankShells.length,driving:drivingTank(game),visible:!!tankView?.root.visible}:null,
     deathAnimations:[...actors.values()].filter(v=>!!v.userData.avatar?.death).length,
     deathPhases:game?.actors.filter(a=>!a.alive&&Number.isFinite(a.deathAt)).map(a=>({id:a.id,...deathMotion(a,deathAge(a,game.state.time))}))||[],
     playerDeathCamera:!!watchingPlayerDeath(),
     weaponModel:activeViewModel?.userData?.id??null,
     viewmodelSource:activeViewModel?.userData?.hissrumSource??null,
     viewmodelType:activeViewModel?.userData?.originalStrikeKit?'skinned-hands':'fitted-gloves',
     viewmodelSkinnedHands:activeViewModel?.getObjectByName('kit-skinned-glove')?.isSkinnedMesh===true,
     weaponStageScale:weaponStage?.scale.x??null,
     botWorldWeapons:[...actors.values()].filter(v=>v.userData.worldGuns?.size>0).length,
     spawnSpread:game?.actors?.length?
       Math.min(...game.actors.flatMap((a,i)=>game.actors.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z)))):null,
     flying:!!game?.player?.flying,scopeActive:!!(game?.player?.weapon==='sniper'&&aiming),
     fov:camera.fov,tapeCollidersExcluded:world.statistics.nonSolidTapeMeshes,
     viewport:(()=>{
       const rect=canvas.getBoundingClientRect();
       const sight=$('crosshair').getBoundingClientRect();
       return {canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
         reticle:{x:sight.x+sight.width/2,y:sight.y+sight.height/2},
         cameraAspect:camera.aspect,weaponAspect:weaponCamera.aspect,
         inlineCanvasWidth:canvas.style.width,inlineCanvasHeight:canvas.style.height,
         pixelWidth:canvas.width,pixelHeight:canvas.height};
     })(),
     dwarfCount:game?.state.wanderers?.length||0,
     visibleDwarfs:actionVisuals?.dwarfs?.size||0,
     flyingBots:game?.actors?.filter(a=>a.bot&&a.alive&&a.flying).length||0,
     botFlightEnabled:!!game?.config.botFlight,
     tacticalAIEnabled:!!game?.config.tacticalAI,
     autoFireEnabled:coarse&&settings.autoFire,
     autoAimProgress:game?.player?.autoAimProgress??0,
     simulationTime:game?.state.time??0,
     playerShotAt:weaponShotAt,equippedWeapon:game?.player?.weapon??null,
     magazine:game?.player?game.item(game.player)?.ammo:null,
     rawAimPitch:game?.player?.rawAimPitch??null,
     effectiveAimPitch:game?.player?.pitch??null,
     recoil:game?.player?.aimRecoil?{...game.player.aimRecoil}:null,
     shopOpen,money:game?.player?.money??0,
     touchInput:{forward:touchForward,strafe:touchStrafe,fire:touchFire,jump:touchJump,descend:touchDescend,interact},
     scoreboardOpen:scoreOpen,allyMarkersEnabled:settings.allyMarkers,combatFeedbackEnabled:settings.combatFeedback,
     combatPresentation:combatHUD?.diagnostics()??null,
     maxFlyingBots:game?.config.maxFlyingBots??0,
     grenadeSpeed:game?.config.playerGrenadeSpeed??0,
     trajectoryPoints:grenadeView?.pointCount??0,

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
   // QA hooks are available ONLY when ?test is explicitly requested.
   // Death previews mutate test fixtures only, never the production match.
   let hudTestSerial=9000000;
   window.__hissrumVisualTest={
     previewFatalHit:()=>{
       const p=game?.player,enemy=game?.actors.find(a=>a.team!==p?.team);
       if(!p?.alive||!enemy)return false;
       game.config.botFire=false;p.spawnProtectedUntil=0;
       const killed=game.damage(p,1000,enemy,'ar47');
       if(killed)p.respawnAt=game.state.time+8;
       return killed;
     },
     prepareTank:()=>{
       const t=game?.state.tank,p=game?.player;if(!t?.alive||!p)return false;
       // TEST ONLY: real model, original pad, same entry controls and cannon.
       for(const a of [...game.actors,...game.hostages,...(game.state.wanderers||[])]){
         if(a!==p){a.alive=false;a.respawnAt=Infinity;}
       }
       game.config.botFire=false;game.config.wanderers=false;game.state.projectiles=[];game.state.grenades=[];game.state.tankShells=[];
       const yaw=[0,Math.PI/2,Math.PI,-Math.PI/2].find(y=>[.5,1,1.5,2.5].every(d=>
         tankFits(world,t.x-Math.sin(y)*d,t.z-Math.cos(y)*d,y)))??0;
       t.yaw=yaw;t.turretYaw=yaw;t.speed=0;t.driverId=null;t.team=null;
       const beside=[1.9,-1.9].map(d=>({x:t.x+Math.cos(yaw)*d,z:t.z-Math.sin(yaw)*d}))
         .find(n=>world.canOccupy(n.x,n.z,.2,1.7,0));
       if(!beside)return false;
       Object.assign(p,beside,{y:0,hp:100,armor:0,alive:true,vehicleId:null,flying:false,
         vy:0,height:1.7,respawnAt:null,deathAt:null,deathCause:null,action:null});
       p.yaw=p.rawAimYaw=lookYaw=yaw;p.pitch=p.rawAimPitch=lookPitch=0;
       resetControls();syncSpecialHUD();return {home:{...t.home},x:t.x,z:t.z};
     },
     damageTank:(amount=80)=>{
       if(!game?.state.tank)return false;
       const source=game.actors.find(a=>a.team!==game.player.team);
       return game.damage(game.state.tank,Math.min(5000,Math.max(0,amount)),source,'bazooka');
     },
     advanceVehicleRespawn:()=>{
       if(!game?.state.tank||game.state.tank.alive)return false;
       game.player.respawnAt=Infinity;
       const until=game.state.tank.respawnAt+.1;
       while(game.state.time<until)game.step(1/60,{});
       return game.state.tank.generation;
     },
     previewCombatFeedback:()=>{
       const p=game?.player,enemy=game?.actors.find(a=>a.team!==p?.team);
       if(!p?.alive||!enemy||!combatHUD)return false;
       const time=game.state.time;
       combatHUD.handle([
         {type:'combat-hit',serial:++hudTestSerial,time,actorId:p.id,targetId:enemy.id,amount:25,head:true,lethal:true},
         {type:'damage',serial:++hudTestSerial,time,actorId:p.id,sourceId:enemy.id,amount:10,sourcePosition:{x:p.x+4,z:p.z}},
         {type:'combat-medal',serial:++hudTestSerial,time,actorId:p.id,title:'DOUBLE ELIMINATION',detail:'TEST · 2 i rad',points:100,kind:'kill'}
       ],game);
       combatHUD.update(game,camera,{enabled:true,markers:settings.allyMarkers,feedback:true,scope:aiming,weapon:WEAPONS[p.weapon]});
       return true; // presentation only: no HP, kills, score or credit mutation
     },
     prepareAutoFire:(weapon='sniper')=>{
       if(!game||!['sniper','smg','ar47','p9'].includes(weapon))return false;
       // TEST ONLY: actual original GLB visibility and actual Game.fire.
       const p=game.player,home=world.anchors.analysts[0];
       const origin={x:home.x,y:1.58,z:home.z};
       const n=world.navigation.nodes.find(n=>{
         const d=Math.hypot(n.x-home.x,n.z-home.z);
         return d>4&&d<7&&world.canTravel(home,n,.25,1.7)&&
           world.segmentClear(origin,{x:n.x,y:1,z:n.z},{vision:false});
       });
       if(!n)return false;
       for(const a of [...game.actors,...game.hostages,...(game.state.wanderers||[])]){
         if(a!==p){a.alive=false;a.respawnAt=Infinity;}
       }
       const target=game.actors.find(a=>a.team!==p.team);
       Object.assign(target,{x:n.x,z:n.z,y:0,height:1.7,alive:true,hp:10000,armor:0,
         bot:null,vy:0,flying:false,spawnProtectedUntil:0,deathAt:null,respawnAt:null});
       Object.assign(p,{x:home.x,z:home.z,y:0,alive:true,hp:10000,armor:0,height:1.7,
         flying:false,vy:0,reloadUntil:0,nextShot:0,action:null,flashUntil:0,
         weapon,rawAimYaw:0,rawAimPitch:0,aimRecoil:null,deathAt:null,respawnAt:null});
       if(weapon==='p9')p.inventory.pistol=game.weaponItem(weapon);
       else p.inventory.primary=game.weaponItem(weapon);
       game.state.smokes=[];game.config.botFire=false;
       game.events=[];game.soundEvents=[];game.pendingDamage=[];weaponShotAt=-Infinity;
       lookYaw=Math.atan2(-(target.x-p.x),-(target.z-p.z));
       lookPitch=Math.atan2(1-origin.y,Math.hypot(target.x-p.x,target.z-p.z));
       p.rawAimYaw=p.yaw=lookYaw;p.rawAimPitch=p.pitch=lookPitch;
       resetControls();return {since:game.state.time,ammo:game.item(p).ammo};
     },

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
     },
     previewNpcDeath:()=>{
       // Test-only simulation. The normal game still controls real health,
       // scoring, respawn and deaths through its own damage system.
       const a=game?.actors.find(a=>a.alive&&a.bot&&!a.isPlayer);
       if(!a)return null;
       Object.assign(a,{alive:false,hp:0,deathAt:game.state.time,
         respawnAt:game.state.time+5});
       return a.id;
     },
     previewPlayerDeath:()=>{
       const a=game?.player;
       if(!a?.alive)return false;
       Object.assign(a,{alive:false,hp:0,deathAt:game.state.time,
         respawnAt:game.state.time+5});
       return true;
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
