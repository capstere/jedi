from pathlib import Path
root=Path('games/hissrum-strike')
p=root/'src/main.mjs'
s=p.read_text()
def change(a,b):
    global s
    assert s.count(a)==1, (s.count(a),a[:120])
    s=s.replace(a,b)
change("import {GrenadeView} from './grenade-view.mjs';", "import {GrenadeView} from './grenade-view.mjs';\nimport {bindTouchControls} from './touch-controls.mjs';\nimport {KillFeedView,drawPlayerHeading} from './hud-polish.mjs';")
change("const canvas=$('scene'),coarse=matchMedia('(pointer:coarse)').matches;", "const canvas=$('scene'),coarse=matchMedia('(pointer:coarse)').matches;\nconst reducedMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');\nconst killFeedView=new KillFeedView($('killfeed'));\nlet touchControls=null;")
change("  addEventListener('resize',()=>{\n    camera.aspect", "  addEventListener('resize',()=>{\n    resetControls(); // cancel old screen-space gestures after orientation/viewport changes\n    camera.aspect")
change("function resetControls(){\n keys.clear();", "function resetControls(){\n touchControls?.reset();\n keys.clear();")
change("reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches", "reducedMotion:reducedMotionQuery.matches")
change("""   ctx.fillStyle='#fff';ctx.beginPath();
   ctx.moveTo(x-Math.sin(a.yaw)*7,y-Math.cos(a.yaw)*7);
   ctx.lineTo(x+Math.sin(a.y+.6)*6,y+Math.cos(a.y+.6)*6);
   ctx.lineTo(x+Math.sin(a.y-.6)*6,y+Math.cos(a.y-.6)*6);
   ctx.closePath();ctx.fill();""", "   ctx.fillStyle='#fff';drawPlayerHeading(ctx,x,y,a.yaw);")
a=s.index(" const node=$('killfeed');node.replaceChildren();")
b=s.index('\n}\nfunction refreshHUD',a)
s=s[:a]+" killFeedView.render(feed);"+s[b:]
a=s.index('function setupTouch(){');b=s.index("\n$('scoreboard-button')",a)
s=s[:a]+"""function setupTouch(){
 touchControls=bindTouchControls({
   pad:$('move-pad'),stick:$('move-stick'),look:$('look-zone'),
   buttons:document.querySelectorAll('[data-touch]'),
   enabled:()=>active&&!paused&&!shopOpen&&!scoreOpen,
   onMove:(strafe,forward)=>{touchStrafe=strafe;touchForward=forward;},
   onLook:(dx,dy)=>{
     const sense=settings.mobileSensitivity*(aiming?.46:1);
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
"""+s[b:]
change("     shopOpen,money:game?.player?.money??0,", "     shopOpen,money:game?.player?.money??0,\n     touchInput:{forward:touchForward,strafe:touchStrafe,fire:touchFire,jump:touchJump,descend:touchDescend,interact},")
p.write_text(s)
p=root/'index.html';t=p.read_text();assert 'main.mjs?v=cartridge-tank-v9' in t
p.write_text(t.replace('main.mjs?v=cartridge-tank-v9','main.mjs?v=polish-v10'))
p=root/'tests/browser-smoke.cjs';s=p.read_text()
a="const assert=require('node:assert/strict');";assert s.count(a)==1
s=s.replace(a,a+"\nconst {runInputHudPolishChecks}=require('./input-hud-browser.cjs');",1)
a='  // Cartridge tank: original GLB pad, actual touch controls and real Game damage.';assert s.count(a)==1
s=s.replace(a,'  await runInputHudPolishChecks(mobile,phone);\n'+a,1);p.write_text(s)
