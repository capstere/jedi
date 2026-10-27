import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/fps/game.mjs';
import {initializeCombat} from '../src/fps/combat-flow.mjs';
import {TANK,initializeTank,tankFits,tankRay,toggleTank,controlTank,tickTank,fireTank,drivingTank,nearTank} from '../src/fps/cartridge-tank.mjs';
import {deathMotion} from '../src/characters/death-motion.mjs';
function fixture(){
 const nodes=[];for(let x=-14;x<=14;x+=2)for(let z=-14;z<=14;z+=2)nodes.push({x,z});
 const world={anchors:{analysts:[{x:0,z:6}],counterAnalysts:[{x:8,z:-10}],hostages:[],bomb:{x:4,z:3}},
 navigation:{nodes,nearest:p=>nodes.reduce((a,n)=>Math.hypot(n.x-p.x,n.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?n:a,nodes[0])},
 canOccupy:(x,z,r,h,y=0)=>Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)+r<15&&Math.abs(z)+r<15&&y===0,
 segmentClear:()=>true,raycast:()=>null,materialAt:()=> 'concrete'};
 const g=new Game(world,{config:{mode:'endless',cartridgeTank:true}});
 const make=(id,team,x,z,isPlayer=false)=>({id,name:id,team,x,z,y:0,yaw:0,pitch:0,height:1.7,radius:.2,
   isPlayer,alive:true,hp:100,armor:0,money:1000,kills:0,deaths:0,inventory:g.startInventory(team),weapon:'p9',
   recoil:0,flash:0,moving:0,spawnProtectedUntil:0,nextShot:0,reloadUntil:0,action:null,respawnAt:null});
 const p=make('p','analysts',0,6,true),enemy=make('e','counterAnalysts',8,-10),ally=make('a','analysts',-10,-10);
 Object.assign(g.state,{phase:'active',mode:'endless',time:5,actors:[p,enemy,ally],hostages:[],wanderers:[],bomb:{status:'inactive'},projectiles:[]});
 g.pendingDamage=[];initializeCombat(g);initializeTank(g);
 const t=g.state.tank;
 const mount=()=>{Object.assign(p,{x:t.x+1.9,z:t.z,y:0});assert.ok(toggleTank(g));g.state.time+=.31;};
 const hits=()=>{for(const h of g.pendingDamage.splice(0))g.damage(h.target,h.amount,h.source,h.kind,h);};
 return {g,world,p,enemy,ally,t,mount,hits};
}
test('tank pad is valid original-floor placement and immutable; no proxy map',()=>{
 const {g,world,t}=fixture();assert.ok(tankFits(world,t.x,t.z,t.yaw));assert.ok(Object.isFrozen(t.home));
 assert.equal(t.hp,900);assert.equal(t.alive,true);assert.equal(t.kind,'vehicle');
 assert.deepEqual(fixture().t.home,t.home);
 world.navigation.nodes=[];assert.throws(()=>initializeTank(g),/safe Cartridge tank/);
});
test('boarding and exiting respect distance, line of sight, pause and collision; all inventory preserved',()=>{
 const {g,world,p,t,mount}=fixture(),inv=JSON.stringify(p.inventory);
 assert.equal(toggleTank(g),false);assert.equal(nearTank(g),false);
 mount();assert.ok(drivingTank(g));assert.equal(p.x,t.x);assert.equal(p.flying,false);
 world.canOccupy=()=>false;assert.equal(toggleTank(g),false,'cannot exit inside wall');assert.ok(drivingTank(g));
 world.canOccupy=()=>true;assert.ok(toggleTank(g));assert.equal(p.vehicleId,null);assert.equal(JSON.stringify(p.inventory),inv);
 g.pause(true);assert.equal(toggleTank(g),false);
});
test('tank steering and forward/back movement use full hull clearance and stop at walls',()=>{
 const {g,world,p,t,mount}=fixture();mount();const start={x:t.x,z:t.z};
 for(let i=0;i<30;i++)controlTank(g,p,{forward:1,yaw:0,pitch:0},1/60);
 assert.ok(t.z<start.z-.4);assert.equal(t.x,p.x);assert.equal(t.z,p.z);
 const old=t.yaw;controlTank(g,p,{strafe:1},.05);assert.notEqual(t.yaw,old);
 world.canOccupy=()=>false;const stopped={x:t.x,z:t.z};controlTank(g,p,{forward:1},.1);
 assert.deepEqual({x:t.x,z:t.z},stopped);assert.equal(t.speed,0);
});
test('runover kills hostile ground actor once, never teammates, protected spawns or airborne actors',()=>{
 const {g,p,enemy,t,mount}=fixture();mount();t.speed=7;
 Object.assign(enemy,{x:t.x,z:t.z-1.55,y:0});controlTank(g,p,{forward:1},1/60);
 assert.equal(enemy.alive,false);assert.equal(p.kills,1);assert.equal(enemy.deathCause.weapon,'ram');
 controlTank(g,p,{forward:1},1/60);assert.equal(p.kills,1);
 for(const variant of ['friend','protected','airborne']){
  const f=fixture();f.mount();f.t.speed=7;
  Object.assign(f.enemy,{x:f.t.x,z:f.t.z-1.55,y:variant==='airborne'?3:0});
  if(variant==='friend')f.enemy.team=f.p.team;
  if(variant==='protected')f.enemy.spawnProtectedUntil=100;
  controlTank(f.g,f.p,{forward:1},1/60);assert.equal(f.enemy.hp,100,variant);
 }
});
test('cannon fires bounded real swept rounds, cooldown, wall cover and normal kill scoring',()=>{
 const f=fixture();f.mount();Object.assign(f.enemy,{x:f.t.x,z:f.t.z-5});
 assert.ok(fireTank(f.g));assert.equal(fireTank(f.g),false);assert.equal(f.g.state.tankShells.length,1);
 for(let i=0;i<20;i++){f.g.state.time+=1/60;tickTank(f.g,1/60);f.hits();}
 assert.equal(f.enemy.alive,false);assert.equal(f.p.kills,1);assert.equal(f.enemy.deathCause.weapon,'cannon');
 const a=fixture();a.mount();Object.assign(a.enemy,{x:a.t.x,z:a.t.z-6});
 a.world.raycast=()=>({distance:.05});a.world.segmentClear=()=>false;
 fireTank(a.g);tickTank(a.g,1/60);a.hits();assert.equal(a.enemy.hp,100,'solid wall blocks blast');
 a.g.pause(true);assert.equal(fireTank(a.g),false);
});
test('hull ray intersection has finite height and orientation, shields driver from ordinary shots',()=>{
 const {g,p,enemy,t,mount,hits}=fixture();mount();
 Object.assign(enemy,{x:t.x,z:t.z-6,yaw:Math.PI,weapon:'p12'});enemy.inventory.pistol=g.weaponItem('p12');
 const origin={x:enemy.x,y:1.4,z:enemy.z};assert.ok(tankRay(origin,{x:0,y:0,z:1},t,20)>0);
 assert.equal(tankRay({...origin,y:4},{x:0,y:0,z:1},t,20),null);
 assert.equal(tankRay(origin,{x:0,y:0,z:1},t,1),null);
 g.fire(enemy,true);hits();assert.ok(t.hp<900&&t.hp>800);assert.equal(p.hp,100);
 g.damage(p,100,enemy,'ar47');assert.equal(p.hp,100);assert.ok(t.hp<850);
 assert.equal(g.buy('sniper').ok,false);assert.equal(g.select('knife'),false);
});
test('destruction kills driver through real Game death once and respawns only at original pad after delay',()=>{
 const {g,p,enemy,t,mount}=fixture();mount();const pad={...t.home};t.x+=3;
 g.damage(t,5000,enemy,'bazooka');assert.equal(t.alive,false);assert.equal(t.hp,0);
 assert.equal(p.alive,false);assert.equal(p.vehicleId,null);assert.equal(enemy.kills,1);
 assert.equal(g.damage(t,5000,enemy,'bazooka'),false);assert.equal(enemy.kills,1);
 g.state.time=t.respawnAt-.1;tickTank(g,0);assert.equal(t.alive,false);
 g.state.time+=.2;Object.assign(enemy,pad);tickTank(g,0);assert.equal(t.alive,false,'wait instead of spawn on living actor');
 enemy.x+=7;tickTank(g,0);assert.ok(t.alive);assert.equal(t.hp,TANK.hp);assert.equal(t.generation,2);
 assert.deepEqual({x:t.x,y:t.y,z:t.z,yaw:t.yaw},pad);assert.equal(t.driverId,null);
});
test('parked armor takes grenade blast; driver is not charged twice for the same explosion',()=>{
 const {g,enemy,t,mount,p,hits}=fixture();mount();
 g.detonateGrenade({x:t.x,y:.5,z:t.z+1,type:'he',ownerId:enemy.id});
 assert.equal(g.pendingDamage.filter(h=>h.target===t).length,1);
 assert.equal(g.pendingDamage.filter(h=>h.target===p).length,0);
 hits();assert.ok(t.hp<900);assert.equal(p.hp,100);
});
test('death impact, headshot/heavy fall and settled pose are deterministic; do not mutate gameplay',()=>{
 const a={yaw:0,y:3,deathCause:{weapon:'ar47',head:true,direction:{x:1,z:0}}},before=JSON.stringify(a);
 const first=deathMotion(a,.1),rest=deathMotion(a,2);
 assert.equal(first.phase,'impact');assert.ok(first.roll>0);assert.equal(rest.phase,'settled');assert.equal(rest.roll,0);
 assert.ok(deathMotion({...a,deathCause:{weapon:'ram'}},.5).heavy);
 assert.ok(rest.airDrop>3);assert.equal(JSON.stringify(a),before);
});
