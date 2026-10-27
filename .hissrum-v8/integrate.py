from pathlib import Path
ROOT=Path.cwd()
G=ROOT/'games/hissrum-strike'

def modify(path, edits):
 p=G/path;c=p.read_text()
 for a,b in edits:
  if a not in c:raise RuntimeError(f'{path}: missing {a[:90]!r}')
  c=c.replace(a,b,1)
 p.write_text(c)

modify('index.html',[
 ('style.css?v=arsenal-v7','style.css?v=combat-hud-v8'),
 ('src/main.mjs?v=arsenal-v7','src/main.mjs?v=combat-hud-v8'),
 ('<span>AUTOELD · FÄLTARSENAL</span>','<span>STRIDSFEEDBACK · LAGMARKÖRER</span>'),
 ('      <label>Fantasidvärgar', '''      <label>Lagkamratsmarkörer
        <select id="ally-marks-mode"><option value="on">Visa markörer</option><option value="off">Dölj markörer</option></select>
      </label>
      <label>Träff- och stridsfeedback
        <select id="combat-feedback-mode"><option value="on">Tydlig feedback</option><option value="off">Avskalad</option></select>
      </label>
      <label>Fantasidvärgar'''),
 ('<div class="round-time"><span id="phase">','<button type="button" id="scoreboard-button" class="round-time" aria-label="Öppna resultattavla" title="Resultattavla · Tab"><span id="phase">'),
 ('<small id="round">RUNDA 1</small></div>','<small id="round">RUNDA 1</small></button>'),
 ('  <div id="hit" aria-hidden="true">×</div>', '''  <div id="ally-marks" aria-hidden="true" hidden></div>
  <div id="damage-compass" aria-hidden="true" hidden><span hidden><i></i></span><span hidden><i></i></span><span hidden><i></i></span><span hidden><i></i></span></div>
  <div id="hit" aria-hidden="true">×</div>
  <div id="combat-hit-label" aria-hidden="true" hidden></div>
  <div id="combat-medal" role="status" hidden><small id="medal-points"></small><strong id="medal-title"></strong><span id="medal-detail"></span></div>'''),
 ('<small id="reload-hint">R · LADDA OM</small></div>','<small id="reload-hint">R · LADDA OM</small><div id="reload-meter" role="progressbar" aria-label="Omladdning" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></div></div>'),
 ('    <button id="resume" class="primary">', '''    <label class="pause-setting">Lagkamratsmarkörer
      <select id="ally-marks-pause"><option value="on">Visa markörer</option><option value="off">Dölj markörer</option></select>
    </label>
    <label class="pause-setting">Träff- och stridsfeedback
      <select id="combat-feedback-pause"><option value="on">Tydlig feedback</option><option value="off">Avskalad</option></select>
    </label>
    <button id="resume" class="primary">'''),
 ('    <button id="play-again" class="primary">','    <button id="end-stats" class="secondary">VISA RESULTATTAVLAN</button>\n    <button id="play-again" class="primary">'),
 ('<section id="shop"', '''<section id="scoreboard" class="screen screen-pause" hidden aria-labelledby="scoreboard-title">
  <div class="score-card" role="dialog" aria-modal="true">
    <p class="eyebrow">HISSRUM 12 · RESULTAT FÖR DENNA MATCH</p>
    <h2 id="scoreboard-title">RESULTATTAVLA</h2>
    <p id="scoreboard-summary"></p>
    <table class="score-table"><caption>Elimineringar, dödsfall, assist och poäng</caption><thead><tr><th scope="col">SPELARE</th><th scope="col"><abbr title="Elimineringar">K</abbr></th><th scope="col"><abbr title="Dödsfall">D</abbr></th><th scope="col"><abbr title="Assist">A</abbr></th><th scope="col">POÄNG</th></tr></thead><tbody id="scoreboard-rows"></tbody></table>
    <p class="score-note">Poäng är matchstatistik, inte butikskrediter. Botmatchen är pausad medan tavlan visas.</p>
    <button id="scoreboard-close" class="primary">TILLBAKA · TAB / ESC</button>
  </div>
</section>
<section id="shop"'''),
 ('B köp vapen när som helst · G granat','Tab resultattavla · B köp vapen när som helst · G granat'),
 ('Manuell eld finns i pausmenyn.','Tryck på matchklockan för resultattavlan. Manuell eld och markörer väljs i pausmenyn.'),
 ('Den ursprungliga V5-modellen är oförändrad.','Lagmarkörer, riktad skadeindikator, tydliga huvudträffar och resultattavla hjälper dig läsa striden. V5-modellen är oförändrad.')
])

modify('src/main.mjs',[
 ("import {GrenadeView} from './grenade-view.mjs';","import {GrenadeView} from './grenade-view.mjs';\nimport {CombatHUD} from './combat-hud.mjs?v=combat-hud-v8';"),
 ('autoFire:true,trajectory:true};','autoFire:true,trajectory:true,allyMarkers:true,combatFeedback:true};'),
 ("let shopOpen=false,grenadeView=null;","try{settings.allyMarkers=localStorage.getItem('hissrum.allyMarkers')!=='off';settings.combatFeedback=localStorage.getItem('hissrum.combatFeedback')!=='off';}catch{}\nlet shopOpen=false,grenadeView=null,combatHUD=null,scoreOpen=false,scoreReturn='game';"),
 (',hitUntil=0,damageUntil=0;',',damageUntil=0;'),
 ('function selectGrenade(){', '''function updateReadabilitySettings(){
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
function selectGrenade(){'''),
 (" shopOpen=false;setHidden('shop',true);resetControls();grenadeView?.clear();", " scoreOpen=false;setHidden('scoreboard',true);combatHUD?.reset();feed.length=0;\n shopOpen=false;setHidden('shop',true);resetControls();grenadeView?.clear();"),
 (' resetControls();grenadeView?.update(game,false);',' resetControls();grenadeView?.update(game,false);combatHUD?.hide();'),
 (" resetControls();setHidden('shop',true);shopOpen=false;", " resetControls();setHidden('shop',true);shopOpen=false;scoreOpen=false;setHidden('scoreboard',true);"),
 ('function mainMenu(){\n resetControls();',"function mainMenu(){\n scoreOpen=false;setHidden('scoreboard',true);combatHUD?.reset();\n resetControls();"),
 (' const events=game.drainEvents();',' const events=game.drainEvents();\n combatHUD?.handle(events,game);'),
 ("   if(event.type==='combat-hit'&&event.actorId===game.player.id)hitUntil=performance.now()+170;\n",''),
 (" $('hit').style.opacity=now<hitUntil?'1':'0';\n",''),
 ('   if(now-lastHud>100){refreshHUD(now);lastHud=now;}','''   if(now-lastHud>100){refreshHUD(now);lastHud=now;}
   combatHUD?.update(game,camera,{enabled:active&&!paused,markers:settings.allyMarkers,
     feedback:settings.combatFeedback,scope:aiming,weapon:WEAPONS[game.player.weapon]});'''),
 (' }else{\n   if(world&&!game){',' }else{\n   combatHUD?.hide();\n   if(world&&!game){'),
 (" if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();\n if(e.code==='Escape'){if(shopOpen)closeShop();else if(active&&!paused)pauseGame();return;}", """ if(e.code==='Tab'&&game&&((active&&!paused)||scoreOpen)){
   e.preventDefault();if(!e.repeat){if(scoreOpen)closeScoreboard();else openScoreboard();}return;
 }
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(scoreOpen)closeScoreboard();else if(shopOpen)closeShop();else if(active&&!paused)pauseGame();return;}"""),
 ("$('shop-button').addEventListener('click',openShop);", """$('scoreboard-button').addEventListener('click',openScoreboard);
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
$('shop-button').addEventListener('click',openShop);"""),
 (' audioSystem=new AudioSystem(world,{volume:.55,ambient:true});',' audioSystem=new AudioSystem(world,{volume:.55,ambient:true});\n combatHUD=new CombatHUD(document);'),
 ('     shopOpen,money:game?.player?.money??0,', '''     shopOpen,money:game?.player?.money??0,
     scoreboardOpen:scoreOpen,allyMarkersEnabled:settings.allyMarkers,combatFeedbackEnabled:settings.combatFeedback,
     combatPresentation:combatHUD?.diagnostics()??null,'''),
 ('   window.__hissrumVisualTest={','''   let hudTestSerial=9000000;
   window.__hissrumVisualTest={
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
     },''')
])
# CSS appendix and documentation are checked into this same temporary workspace.
css=G/'style.css';css.write_text(css.read_text()+'\n'+(ROOT/'.hissrum-v8/combat.css').read_text())
readme=G/'README.md';readme.write_text(readme.read_text()+'\n'+(ROOT/'.hissrum-v8/readme.md').read_text())
