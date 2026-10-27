from pathlib import Path
p=Path('games/hissrum-strike/src/main.mjs');s=p.read_text()
def swap(a,b):
 global s
 assert a in s,a[:160];s=s.replace(a,b,1)
swap("import {ActionVisuals} from './action-visuals.mjs';", "import {ActionVisuals} from './action-visuals.mjs';\nimport {isAutoFireWeapon,resetAutoAim} from './fps/aim-controls.mjs';\nimport {GrenadeView} from './grenade-view.mjs';")
swap("const settings={sensitivity:.0021,mobileSensitivity:.0065};", "const settings={sensitivity:.0021,mobileSensitivity:.0065,autoFire:true,trajectory:true};\ntry{settings.autoFire=localStorage.getItem('hissrum.autoFire')!=='off';settings.trajectory=localStorage.getItem('hissrum.trajectory')!=='off';}catch{}\nlet shopOpen=false,grenadeView=null;")
swap("function syncSpecialHUD(){", """function resetControls(){
 keys.clear();fire=false;touchFire=false;touchJump=false;touchDescend=false;interact=false;
 touchForward=0;touchStrafe=0;$('move-stick').style.transform='translate(0,0)';
 if(game?.player){resetAutoAim(game.player);game.player.fireHeld=false;game.player.requireFireRelease=false;}
}
function updateControlSettings(){
 for(const id of ['auto-fire-mode','auto-fire-pause'])$(id).value=settings.autoFire?'auto':'manual';
 for(const id of ['trajectory-mode','trajectory-pause'])$(id).value=settings.trajectory?'on':'off';
 resetControls();if(game)syncSpecialHUD();
}
function selectGrenade(){
 if(!game?.player?.alive||!active||paused)return;
 if(!game.select('grenade'))notice('INGA GRANATER · ÖPPNA KÖP / B',2);
 else{clearScope();resetControls();notice('GRANAT VALD · KASTA MED SKJUT / MUS',2);}
 syncSpecialHUD();
}
function openShop(){
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
function syncSpecialHUD(){""")
swap(" if(!flying)touchDescend=false;\n}", """ if(!flying)touchDescend=false;
 const w=WEAPONS[p?.weapon],automatic=coarse&&settings.autoFire&&isAutoFireWeapon(w);
 const fireButton=document.querySelector('[data-touch="fire"]');
 fireButton.hidden=automatic;
 fireButton.textContent=w?.slot==='grenade'?'KASTA':w?.slot==='knife'?'SLÅ':'SKJUT';
 document.querySelector('.touch-actions').classList.toggle('auto-fire',automatic);
 $('auto-status').hidden=!automatic||!p?.alive;
 const lock=p?.autoAimProgress??0;
 $('auto-status').classList.toggle('locking',p?.weapon==='sniper'&&lock>0);
 $('auto-status').textContent=p?.weapon==='sniper'&&lock>0?'SIKTA · '+Math.round(lock*100)+' %':'AUTO';
 $('grenade-status').hidden=!(p?.alive&&w?.slot==='grenade');
}
""")
swap("function startGame(){\n if(!world)return;", "function startGame(){\n if(!world)return;\n shopOpen=false;setHidden('shop',true);resetControls();grenadeView?.clear();")
swap("     tacticalAI:true, // GLB cover, flanks and observed-squad coordination", "     tacticalAI:true,progressiveRecoil:true,liveShop:true,openArsenal:true,\n     agileFlight:true,maxFlyingBots:4,botFlySpeed:4.5,playerGrenadeSpeed:17,")
swap("function pauseGame(){\n if(!game||!active||paused)return;", "function pauseGame(){\n if(!game||!active||paused)return;\n resetControls();grenadeView?.update(game,false);")
swap("function resumeGame(){\n if(!game||!active)return;", "function resumeGame(){\n if(!game||!active)return;\n resetControls();setHidden('shop',true);shopOpen=false;")
swap("function mainMenu(){\n active=false;", "function mainMenu(){\n resetControls();shopOpen=false;setHidden('shop',true);grenadeView?.clear();\n active=false;")
swap("   if(event.type==='tracer'&&event.from&&event.to)showTracer(event);", """   if(event.type==='tracer'&&event.from&&event.to)showTracer(event);
   if(event.type==='respawn'&&event.actorId===game.player.id){
     lookYaw=game.player.rawAimYaw??game.player.yaw;lookPitch=0;resetControls();clearScope();
   }
   if(event.type==='throw'&&event.actorId===game.player.id){fire=false;touchFire=false;}
""")
swap("   const bob=p.alive&&p.moving>.2&&!p.crouching\n     ?Math.sin(game.state.time*12)*Math.min(.032,p.moving*.008):0;\n   camera.position.set(a.x,a.y+a.height-.13+bob,a.z);", "   // Crosshair and authoritative bullet origin coincide, including recoil.\n   camera.position.set(a.x,a.y+a.height-.12,a.z);")
swap("  fire:fire||touchFire,", "  fire:coarse?touchFire:fire,\n  autoFire:coarse&&settings.autoFire&&!paused&&!shopOpen,")
swap("   updateEvents();syncCharacters(dt);cameraFollow(dt);", "   updateEvents();syncCharacters(dt);cameraFollow(dt);\n   grenadeView?.update(game,settings.trajectory);")
swap(" if(e.code==='Escape'){if(active&&!paused)pauseGame();return;}"," if(e.code==='Escape'){if(shopOpen)closeShop();else if(active&&!paused)pauseGame();return;}")
swap(" if(e.code==='KeyB'&&game.config.mode==='classic'){const result=game.buy($('loadout').value);notice(result.ok?'VAPEN KÖPT':result.reason);}"," if(e.code==='KeyB'){e.preventDefault();openShop();return;}\n if(e.code==='KeyG'){e.preventDefault();selectGrenade();return;}")
swap("canvas.addEventListener('mousedown',e=>{\n if(!active||paused)return;", "canvas.addEventListener('mousedown',e=>{\n if(!active||paused||coarse)return;")
swap("     if(action==='fire')touchFire=true;", "     if(!active||paused)return;\n     if(action==='fire')touchFire=true;\n     if(action==='grenade')selectGrenade();")
swap("$('start').addEventListener('click',startGame);", """$('shop-button').addEventListener('click',openShop);
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
$('start').addEventListener('click',startGame);""")
swap(" actionVisuals=new ActionVisuals(scene,world);", " actionVisuals=new ActionVisuals(scene,world);\n grenadeView=new GrenadeView(scene,world);")
swap("     tacticalAIEnabled:!!game?.config.tacticalAI,", """     tacticalAIEnabled:!!game?.config.tacticalAI,
     autoFireEnabled:coarse&&settings.autoFire,
     autoAimProgress:game?.player?.autoAimProgress??0,
     simulationTime:game?.state.time??0,
     playerShotAt:weaponShotAt,equippedWeapon:game?.player?.weapon??null,
     magazine:game?.player?game.item(game.player)?.ammo:null,
     rawAimPitch:game?.player?.rawAimPitch??null,
     effectiveAimPitch:game?.player?.pitch??null,
     recoil:game?.player?.aimRecoil?{...game.player.aimRecoil}:null,
     shopOpen,money:game?.player?.money??0,
     maxFlyingBots:game?.config.maxFlyingBots??0,
     grenadeSpeed:game?.config.playerGrenadeSpeed??0,
     trajectoryPoints:grenadeView?.pointCount??0,
""")
s=s.replace('./fps/game.mjs?v=hissrum-ai-v5','./fps/game.mjs?v=arsenal-v7')
p.write_text(s)
