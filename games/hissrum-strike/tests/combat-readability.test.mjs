import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatFeedback,relativeDamageAngle,reloadReadout,scoreboardRows,eligibleAlly} from '../src/fps/combat-readability.mjs';
import {Game,WEAPONS} from '../src/fps/game.mjs';
import {initializeCombat} from '../src/fps/combat-flow.mjs';
const p={id:'player',team:'analysts',name:'DU',x:0,y:0,z:0,yaw:0,alive:true,isPlayer:true};
const enemy={id:'enemy',team:'counterAnalysts',name:'E',x:10,y:0,z:0,alive:true};
const friend={id:'friend',team:'analysts',name:'A',x:-10,y:0,z:0,alive:true};
const fake=()=>({player:{...p},actors:[{...p},{...enemy},{...friend}],state:{time:10}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('damage compass rotates correctly with view; invalid/no-direction hits never invent a bearing',()=>{
 near(relativeDamageAngle(p,{x:0,z:-10}),0);near(relativeDamageAngle(p,{x:10,z:0}),Math.PI/2);
 near(Math.abs(relativeDamageAngle(p,{x:0,z:10})),Math.PI);near(relativeDamageAngle(p,{x:-10,z:0}),-Math.PI/2);
 near(relativeDamageAngle(p,{x:-10,z:0},Math.PI/2),0);
 assert.equal(relativeDamageAngle(p,{x:NaN,z:5}),null);assert.equal(relativeDamageAngle(p,p),null);
});
test('HUD only confirms real hostile hits; headshots and lethal hits take precedence',()=>{
 const g=fake(),hud=new CombatFeedback();
 const hit={type:'combat-hit',actorId:p.id,targetId:enemy.id,time:10,amount:10,serial:1};
 hud.handle([{...hit,targetId:friend.id},{...hit,serial:2,amount:0}],g);assert.equal(hud.hit,null);
 hud.handle([{...hit,serial:3}],g);assert.equal(hud.hit.kind,'body');
 hud.handle([{...hit,serial:4,head:true}],g);assert.equal(hud.hit.kind,'head');
 hud.handle([{...hit,serial:5}],g);assert.equal(hud.hit.kind,'head');
 hud.handle([{...hit,serial:6,head:true,lethal:true}],g);assert.equal(hud.hit.kind,'kill');
 assert.match(hud.hit.label,/HUVUDTRÄFF/);hud.tick(10.5);assert.ok(hud.hit);hud.tick(10.7);assert.equal(hud.hit,null);
});
test('incoming arrows snapshot actual hit origin, expire, and cap at four (no attacker tracking)',()=>{
 const g=fake(),hud=new CombatFeedback(),origin={x:10,z:2};
 hud.handle([{type:'damage',actorId:p.id,sourceId:enemy.id,amount:10,serial:1,time:10,sourcePosition:origin}],g);
 origin.x=500;g.actors[1].x=800;assert.equal(hud.directions[0].x,10);
 for(let i=0;i<9;i++){const a={...enemy,id:'e'+i};g.actors.push(a);
 hud.handle([{type:'damage',actorId:p.id,sourceId:a.id,amount:5,serial:2+i,time:10,sourcePosition:{x:i,z:-5}}],g);}
 assert.equal(hud.directions.length,4);hud.tick(11.59);assert.equal(hud.directions.length,4);
 hud.tick(11.61);assert.equal(hud.directions.length,0);
});
test('feedback deduplicates events, bounds queue, respects pause time, and clears on respawn/restart',()=>{
 const g=fake(),hud=new CombatFeedback();
 const e={type:'combat-medal',actorId:p.id,time:10,serial:1,kind:'kill',title:'DOUBLE ELIMINATION',detail:'2 i rad',points:100};
 hud.handle([e,e],g);assert.equal(hud.medal.points,100);assert.equal(hud.queue.length,0);
 for(let i=2;i<180;i++)hud.handle([{...e,serial:i,kind:'assist'}],g);
 assert.ok(hud.seen.size<=128);assert.equal(hud.queue.length,2);hud.tick(10);assert.ok(hud.medal);
 hud.handle([{type:'respawn',actorId:p.id,time:11,serial:200}],g);assert.equal(hud.medal,null);assert.equal(hud.queue.length,0);
 hud.handle([{...e,serial:300,time:12}],g);hud.handle([{type:'round',time:13}],g);assert.equal(hud.medal,null);assert.equal(hud.seen.size,0);
});
test('scoreboard reads authoritative game totals without touching credits, HP or score',()=>{
 const g=fake();g.actors[0]={...p,kills:5,deaths:2,money:980,combat:{points:575,assists:2,damage:240.3,bestStreak:3}};
 const before=JSON.stringify(g),rows=scoreboardRows(g);assert.equal(JSON.stringify(g),before);
 const me=rows.find(r=>r.player);assert.equal(me.kills,5);assert.equal(me.points,575);assert.equal(me.assists,2);assert.equal(me.damage,240);
 assert.ok(rows.every(r=>Number.isFinite(r.deaths)));
});
test('only living teammates receive markers, never opponents, dwarfs or spectators',()=>{
 assert.equal(eligibleAlly(friend,p),true);assert.equal(eligibleAlly(enemy,p),false);
 assert.equal(eligibleAlly(p,p),false);assert.equal(eligibleAlly({...friend,alive:false},p),false);
 assert.equal(eligibleAlly({id:'dwarf',alive:true},p),false);assert.equal(eligibleAlly(friend,{...p,alive:false}),false);
});
test('reload progress and low-ammo readout follow real weapon timing and ammo, not UI timers',()=>{
 let r=reloadReadout({...p,reloadUntil:12},WEAPONS.smg,{ammo:2},11);
 assert.equal(r.active,true);near(r.progress,1-1/WEAPONS.smg.reload);assert.equal(r.low,false);
 r=reloadReadout({...p,reloadUntil:0},WEAPONS.smg,{ammo:2},12);assert.equal(r.active,false);assert.equal(r.low,true);
 assert.equal(reloadReadout(p,WEAPONS.knife,{ammo:Infinity},12).low,false);
 assert.equal(reloadReadout({...p,alive:false},WEAPONS.smg,{ammo:0},12).low,false);
});
test('real Game damage drives hit, kill, assist and medals; protected or friendly targets do not',()=>{
 const g=new Game({anchors:{},navigation:{nodes:[]}});
 const actor=(a)=>({...a,hp:100,armor:0,height:1.7,radius:.2,kills:0,deaths:0,money:1000,inventory:{},spawnProtectedUntil:0});
 const player=actor(p),e=actor(enemy),ally=actor(friend);
 Object.assign(g.state,{phase:'active',mode:'endless',time:10,actors:[player,e,ally],hostages:[],bomb:{status:'inactive'}});
 initializeCombat(g);const hud=new CombatFeedback();
 e.spawnProtectedUntil=11;assert.equal(g.damage(e,10,player,'smg'),false);hud.handle(g.drainEvents(),g);assert.equal(hud.hit,null);
 e.spawnProtectedUntil=0;assert.equal(g.damage(ally,10,player,'smg'),false);
 g.damage(e,25,ally,'smg');g.damage(e,90,player,'smg',{point:{x:e.x,y:1.6,z:e.z}});
 hud.handle(g.drainEvents(),g);assert.equal(hud.hit.kind,'kill');assert.ok(hud.hit.head);assert.equal(player.kills,1);
 assert.equal(ally.combat.assists,1);assert.equal(player.combat.points,100);assert.equal(player.money,1300);
 assert.ok(hud.medal);assert.equal(hud.medal.points,100);assert.equal(scoreboardRows(g).find(r=>r.id==='friend').assists,1);
});
