import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,WEAPONS} from '../src/fps/game.mjs';
import {automaticTrigger,crosshairEnemy,SNIPER_DWELL} from '../src/fps/aim-controls.mjs';
import {freshRecoil,kickRecoil,recoverRecoil,applyAimRecoil} from '../src/fps/recoil.mjs';
import {grenadeLaunch,advanceGrenade,grenadeTrajectory} from '../src/fps/grenade-ballistics.mjs';
import {updateBotFlight} from '../src/fps/bot-flight.mjs';
function actor(id,team,x=0,z=-8){return {id,name:id,index:0,team,x,z,y:0,yaw:0,pitch:0,height:1.7,radius:.2,alive:true,hp:100,armor:0,isPlayer:false,
 weapon:'smg',inventory:{primary:{id:'smg',ammo:30,reserve:120},pistol:{id:'p9',ammo:20,reserve:80},knife:{id:'knife',ammo:Infinity},he:0,flash:0,smoke:0},
 nextShot:0,reloadUntil:0,flash:0,action:null,spawnProtectedUntil:0,recoil:0,vy:0,onGround:true,moving:0,distanceWalked:0,fireHeld:false,money:5000,kills:0,deaths:0};}
function fixture(){
 const world={raycast:()=>null,segmentClear:()=>true,inside:()=>true,canOccupy:()=>true,canStand:()=>true,materialAt:()=> 'concrete',
 move:(a,dx,dy,dz)=>{a.x+=dx;a.y=Math.max(0,a.y+dy);a.z+=dz;return {onGround:a.y===0,collision:false};},
 navigation:{nearest:p=>p,nodes:[]},findPath:(a,b)=>[b],
 anchors:{analysts:Array.from({length:5},(_,i)=>({x:i*5,z:0,yaw:0})),counterAnalysts:Array.from({length:5},(_,i)=>({x:i*5,z:-15,yaw:Math.PI})),hostages:[{x:20,z:10},{x:25,z:10}],bomb:{x:5,z:5,radius:2},rescue:{x:5,z:5,radius:2}}};
 const g=new Game(world,{config:{mode:'endless',wanderers:false,botFire:false,botFlight:false,liveShop:true,openArsenal:true,progressiveRecoil:true,playerGrenadeSpeed:17},seed:12});
 const p=Object.assign(actor('player','analysts',0,0),{isPlayer:true,aimRecoil:freshRecoil(),rawAimYaw:0,rawAimPitch:0});
 const enemy=actor('enemy','counterAnalysts');
 Object.assign(g.state,{phase:'active',mode:'endless',time:1,actors:[p,enemy],hostages:[],wanderers:[],smokes:[],bomb:{status:'inactive',carrierId:null}});
 g.pendingDamage=[];g.roundCandidates=[];return {g,p,enemy,world};
}
test('mobile trigger requires exact visible hostile; walls, smoke, friends and innocents block it',()=>{
 const {g,p,enemy,world}=fixture();assert.equal(crosshairEnemy(g,p,WEAPONS.smg),enemy);
 world.raycast=()=>({distance:3});assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 world.raycast=()=>null;g.state.smokes=[{x:0,y:1.5,z:-4,radius:1,until:99}];assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 g.state.smokes=[];const friend=actor('friend','analysts',0,-3);g.actors.push(friend);assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 g.actors.pop();g.state.wanderers=[{...friend,team:undefined,kind:'dwarf'}];assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 g.state.wanderers=[];enemy.spawnProtectedUntil=2;assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 enemy.spawnProtectedUntil=0;enemy.x=1;assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
 enemy.x=0;enemy.alive=false;assert.equal(crosshairEnemy(g,p,WEAPONS.smg),null);
});
test('sniper requires .32 continuous simulation seconds on same target and resets after sight loss',()=>{
 const {g,p,world}=fixture();p.weapon='sniper';p.inventory.primary={id:'sniper',ammo:5,reserve:25};
 assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),false);
 g.state.time+=SNIPER_DWELL-.01;assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),false);
 g.state.time+=.02;assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),true);
 world.raycast=()=>({distance:2});assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),false);assert.equal(p.autoAim,null);
 world.raycast=()=>null;g.state.time+=1;assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),false);
 g.actors[1].id='another';g.state.time+=.4;assert.equal(automaticTrigger(g,p,WEAPONS.sniper,true),false);
 assert.equal(automaticTrigger(g,p,WEAPONS.sniper,false),false);assert.equal(p.autoAimProgress,0);
});
test('autofire respects pause, reload, life, ammunition, menu and manual mode; never auto-throws',()=>{
 const {g,p}=fixture();assert.equal(automaticTrigger(g,p,WEAPONS.smg,true),true);
 for(const [field,value] of [['alive',false],['reloadUntil',3],['flash',.9]]){
  const old=p[field];p[field]=value;assert.equal(automaticTrigger(g,p,WEAPONS.smg,true),false);p[field]=old;
 }
 g.state.paused=true;assert.equal(automaticTrigger(g,p,WEAPONS.smg,true),false);g.state.paused=false;
 g.state.phase='buy';assert.equal(automaticTrigger(g,p,WEAPONS.smg,true),false);g.state.phase='active';
 p.inventory.primary.ammo=0;assert.equal(automaticTrigger(g,p,WEAPONS.smg,true),false);p.inventory.primary.ammo=30;
 for(const w of [WEAPONS.knife,WEAPONS.he,WEAPONS.bazooka])assert.equal(automaticTrigger(g,p,w,true),false);
 assert.equal(automaticTrigger(g,p,WEAPONS.smg,false),false);
});
test('fixed-step engine rearms auto pistols but waits for sniper dwell; desktop manual needs trigger',()=>{
 const {g,p,enemy}=fixture();p.weapon='p9';enemy.hp=10000;g.config.progressiveRecoil=false;
 const ammo=p.inventory.pistol.ammo;
 for(let i=0;i<60;i++)g.step(1/60,{autoFire:true,yaw:0,pitch:0});
 assert.ok(p.inventory.pistol.ammo<ammo-1);
 const left=p.inventory.pistol.ammo;
 for(let i=0;i<30;i++)g.step(1/60,{autoFire:false,yaw:0,pitch:0});
 assert.equal(p.inventory.pistol.ammo,left);
 g.select('smg');p.nextShot=0;g.step(1/60,{fire:true,yaw:0,pitch:0});assert.equal(p.inventory.primary.ammo,29);
 p.weapon='sniper';p.inventory.primary=g.weaponItem('sniper');p.nextShot=0;p.autoAim=null;
 for(let i=0;i<18;i++)g.step(1/60,{autoFire:true,yaw:0,pitch:0});assert.equal(p.inventory.primary.ammo,5);
 for(let i=0;i<4;i++)g.step(1/60,{autoFire:true,yaw:0,pitch:0});assert.equal(p.inventory.primary.ammo,4);
});
test('confirmed bursts climb increasingly, recover, and apply to real aim instead of only gun model',()=>{
 const r=freshRecoil();kickRecoil(r,'ar47',0);const first=r.pitch;
 recoverRecoil(r,.105,.105);const before=r.pitch;kickRecoil(r,'ar47',.105);
 assert.ok(r.pitch-before>first);
 for(let i=2;i<12;i++){recoverRecoil(r,.105,i*.105);kickRecoil(r,'ar47',i*.105);}
 assert.ok(r.pitch>first*4);
 for(let i=0;i<120;i++)recoverRecoil(r,1/60,2+i/60);
 assert.ok(r.pitch<.001&&r.heat===0);
 const a={yaw:.2,pitch:.1};a.aimRecoil=freshRecoil();applyAimRecoil(a,{yaw:.2,pitch:.1});kickRecoil(a.aimRecoil,'sniper',3);applyAimRecoil(a,{});
 assert.ok(a.pitch>.1);assert.equal(a.pitch,a.rawAimPitch+a.aimRecoil.pitch);
 const {g,p}=fixture();const start=p.pitch;g.fire(p,true);assert.ok(p.pitch>start);
 const kicked=p.aimRecoil.pitch;p.nextShot=0;p.inventory.primary.ammo=0;g.fire(p,true);assert.equal(p.aimRecoil.pitch,kicked);
});
test('recoil recovery is frame-rate independent at equal simulation time',()=>{
 const a=freshRecoil(),b=freshRecoil();kickRecoil(a,'smg',0);kickRecoil(b,'smg',0);
 for(let i=0;i<60;i++)recoverRecoil(a,1/60,1+i/60);
 for(let i=0;i<30;i++)recoverRecoil(b,1/30,1+i/30);
 assert.ok(Math.abs(a.pitch-b.pitch)<1e-6);
});
test('active-round Classic shop works away from spawn, charges once and rejects invalid purchases',()=>{
 const {g,p}=fixture();g.state.mode='classic';p.x=50;p.money=5000;
 assert.equal(g.buy('cr4').ok,true);assert.equal(p.money,1900);assert.equal(p.weapon,'cr4');
 assert.equal(g.buy('cr4').ok,false);assert.equal(p.money,1900);
 assert.equal(g.buy('sniper').ok,false);assert.equal(p.money,1900);
 assert.equal(g.buy('he').ok,true);assert.equal(p.inventory.he,1);assert.equal(p.money,1600);
 assert.equal(g.buy('he').ok,false);assert.equal(p.money,1600);
 assert.equal(g.buy('armor').ok,true);assert.equal(p.armor,100);assert.equal(p.money,950);
 p.alive=false;assert.equal(g.buy('flash').ok,false);p.alive=true;g.state.phase='result';assert.equal(g.buy('flash').ok,false);
});
test('Endless field arsenal charges credits without changing legacy Classic zone rules',()=>{
 const {g,p}=fixture();assert.equal(g.buy('shotgun').ok,true);assert.equal(p.money,3200);
 g.state.mode='classic';g.config.liveShop=false;p.x=30;assert.equal(g.buy('flash').ok,false);
});
test('long grenade and displayed trajectory share authoritative swept and bouncing integration',()=>{
 const {g,p,world}=fixture(),cfg=g.config;
 const old=grenadeLaunch(p,{...cfg,playerGrenadeSpeed:9}),now=grenadeLaunch(p,cfg);
 assert.ok(Math.hypot(now.vx,now.vz)>Math.hypot(old.vx,old.vz)*1.8);
 p.inventory.he=1;g.throwGrenade(p,'he');assert.equal(g.state.grenades[0].vz,now.vz);
 const path=grenadeTrajectory(p,cfg,world),temp={...now};
 for(let i=0;i<Math.ceil(cfg.grenadeFuse/cfg.fixedStep);i++)advanceGrenade(temp,cfg.fixedStep,world,cfg.gravity);
 assert.ok(Math.abs(path.at(-1).z-temp.z)<1e-8);
 let rays=0;world.raycast=()=>{rays++;return {distance:.09,normal:{x:0,y:0,z:1}};};
 const b={...now};advanceGrenade(b,1/60,world,18);assert.ok(rays>0);assert.ok(b.vz>0);
});
test('agile bots use more slots, orbit seen targets, vary altitude and land for objectives',()=>{
 const {g,enemy}=fixture();const bot=Object.assign(enemy,{index:1,x:0,z:0,y:1.5,hp:100,flying:true,
 bot:{target:{visible:true,lastSensedPosition:{x:8,y:1,z:0}},tactical:{kind:'flank'}},
 airPatrol:{mode:'flight',baseY:2.4,goalY:2.4,until:25,nextVantage:0}});
 Object.assign(g.config,{tacticalAI:true,agileFlight:true,botFlight:true,maxFlyingBots:4,botFlySpeed:4.5});
 g.state.time=10;const input={};updateBotFlight(g,bot,input,1/60);
 assert.ok(Math.abs(input.moveWorld?.z)>0);assert.notEqual(bot.airPatrol.goalY,2.4);
 const rookie=Object.assign(actor('rookie','analysts',3,3),{index:2,bot:{target:bot.bot.target,tactical:{kind:'support'}},flying:false,airPatrol:{mode:'ground',nextAt:0}});
 g.state.actors=[bot,rookie,{...actor('fly2','analysts'),bot:{},flying:true}];
 updateBotFlight(g,rookie,{},1/60);assert.equal(rookie.flying,true);
 rookie.y=1;g.bomb.carrierId=rookie.id;updateBotFlight(g,rookie,{},1/60);assert.equal(rookie.airPatrol.mode,'landing');
});
