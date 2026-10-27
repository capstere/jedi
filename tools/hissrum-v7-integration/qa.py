from pathlib import Path
base=Path('games/hissrum-strike')
p=base/'src/main.mjs';s=p.read_text();a="   window.__hissrumVisualTest={";b=a+"""
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
""";assert a in s;s=s.replace(a,b);p.write_text(s)
p=base/'tests/browser-smoke.cjs';s=p.read_text()
s=s.replace("tactics.tacticalBots.filter(b=>b.flying).length<=2", "tactics.tacticalBots.filter(b=>b.flying).length<=4").replace("'only two tactical flying bots at once on mobile-safe AI'", "'airborne bots stay within the four-flyer cap'")
a="  console.log('PASS: Autonomous tactical bot flight and role-based goals visible during real 5v5 simulation');";b=a+"""
  await page.keyboard.press('KeyB');
  await page.waitForSelector('#shop:not([hidden])',{timeout:5000});
  const credits=(await page.evaluate(()=>window.__hissrumDiagnostics())).money;
  await page.locator('[data-buy="shotgun"]').click();
  let purchased=await page.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(purchased.money,credits-1800);
  assert.equal(purchased.equippedWeapon,'shotgun');
  await page.locator('#shop-close').click();
  await page.waitForFunction(()=>!window.__hissrumDiagnostics().shopOpen);
  console.log('PASS: Desktop B opens real paid field arsenal during round');
""";assert a in s;s=s.replace(a,b)
a="  assert.equal(mobileDiag.characterModelReady,true);";b=a+"""
  assert.equal(mobileDiag.autoFireEnabled,true,'mobile automatic fire must be default');
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),false,'no default fire button');
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#auto-fire-pause').selectOption('manual');
  await mobile.locator('#resume').tap();
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).autoFireEnabled,false);
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),true,'manual mode reveals fire button');
""";assert a in s;s=s.replace(a,b)
a="  assert.deepEqual(issues,[],'Unexpected browser errors/network failures');";b="""
  let aim=await mobile.evaluate(()=>window.__hissrumVisualTest.prepareAutoFire('sniper'));
  assert.ok(aim);
  await mobile.waitForTimeout(500);
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).magazine,5);
  await mobile.locator('#pause-button').tap();
  await mobile.locator('#auto-fire-pause').selectOption('auto');
  await mobile.locator('#resume').tap();
  aim=await mobile.evaluate(()=>window.__hissrumVisualTest.prepareAutoFire('sniper'));
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),false);
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().magazine<5,null,{timeout:45000});
  const fired=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.ok(fired.playerShotAt-aim.since>=.32-1/60,'sniper must complete dwell before first auto shot');
  assert.ok(fired.recoil?.serial>=1,'auto shot must drive real recoil');
  assert.equal(fired.effectiveAimPitch,fired.rawAimPitch+fired.recoil.pitch);
  console.log('PASS: Actual visible-enemy mobile sniper auto-fire, dwell and shared camera/ballistic recoil');
  await mobile.locator('#shop-button').tap();
  const mobileCredits=(await mobile.evaluate(()=>window.__hissrumDiagnostics())).money;
  await mobile.locator('[data-buy="smg"]').tap();
  const mobilePurchase=await mobile.evaluate(()=>window.__hissrumDiagnostics());
  assert.equal(mobilePurchase.money,mobileCredits-1250);
  assert.equal(mobilePurchase.equippedWeapon,'smg');
  await mobile.locator('#shop-close').tap();
  await mobile.locator('#grenade-toggle').tap();
  await mobile.waitForFunction(()=>window.__hissrumDiagnostics().trajectoryPoints>5,null,{timeout:30000});
  assert.equal(await mobile.locator('[data-touch="fire"]').isVisible(),true,'grenades require manual throw');
  assert.equal(await mobile.locator('[data-touch="fire"]').textContent(),'KASTA');
  assert.equal((await mobile.evaluate(()=>window.__hissrumDiagnostics())).grenadeSpeed,17);
  console.log('PASS: Mobile paid arsenal, deliberate grenade control and real-GLB ballistic preview');
"""+a;assert a in s;s=s.replace(a,b);p.write_text(s)
p=base/'README.md';s=p.read_text();s+='''

## v7 — mobil autoeld, progressiv rekyl och fältarsenal

På pekskärm är automatisk eld standard och skjutknappen dold för kulvapen. Siktets exakta stråle måste träffa en levande, synlig fiende inom vapnets räckvidd. Väggar, rök, lagkamrater, gisslan och dvärgar blockerar avfyrningen. Ingen automatisk siktning används. Inställningen kan ändras före start eller i pausmenyn och sparas lokalt. Manuellt läge visar skjutknappen igen. Datorn behåller musavfyrning.

Scope 5 kräver 0,32 sekunders sammanhängande sikte på samma fiende före automatisk avfyrning. Låsningen bryts vid förlorad sikt, byte av mål/vapen, paus, död eller omladdning. Automatisk halvautomatisk eld följer vapnets skottintervall och ammunition.

Rekylen är Riposte-inspirerad, inte en exakt kopia. Både dator och mobil får kameraryck och stigande rekyl under salvor. Kamera och verklig skottstråle använder samma rekylvinkel. Kort paus återhämtar rekyl och spridning; nedåtsikte kan kompensera.

KÖP / B öppnar en fältarsenal under aktiva Classic- och Endless-rundor. Den lokala botmatchen pausas under köp. Vapen, rustning och granater kostar krediter; otillräckliga krediter, fulla fack och redan utrustat vapen nekas utan debitering. Kill-belöning är fortsatt 300 krediter. Endless fyller inte längre på hela kreditpotten vid respawn när arsenalen används. Spelaren får köpa båda lagens gevär; botarnas befintliga köp- och uppdragsregler bevaras.

G / GRANAT väljer eller växlar granat. Granater kastas alltid manuellt (KASTA-knappen visas även med autoeld). Spelarens kasthastighet är 17 i stället för 9 spelvärldsenheter per sekund; botarnas granater behåller originalhastigheten. Den valfria kastbanan använder samma gravitation, kollisionsstrålar, studsar och säkringstid som riktig grenadfysik. Synliga granatprojektiler ingår.

Upp till fyra botar kan flyga samtidigt, med längre flygpass, kortare markpauser, höjdbyten och sidoförflyttning kring faktiskt observerade mål. Korta stilla intervall ger utrymme att sikta och skjuta. Rummets kollisioner gäller fortfarande och uppdragsbärare/skadade botar återgår till marken.

Nya modulgränser: `src/fps/aim-controls.mjs`, `recoil.mjs`, `grenade-ballistics.mjs` och `src/grenade-view.mjs`. `tests/arsenal-v7.test.mjs` täcker siktspärrar, sniperfördröjning, återarmning, rekyl/återhämtning, betalning, granatfysik och flygning. Browser-smoke verifierar även pausinställning, dold/manuell knapp, faktiskt automatiskt skott i original-GLB:n och köp på dator/mobil.
''';p.write_text(s)
