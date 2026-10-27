/** Riposte-inspired combat presentation. No damage, aiming, credits or AI writes.
 * Source references: frontline/source/src/09-game.js (hit/medal/damage feedback)
 * and 09m-marqueurs.js (allied-only markers). See licenses/hissrum-v8-NOTICE.md.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const teams=['analysts','counterAnalysts'];
export function hostile(a,b){return !!a&&!!b&&a.id!==b.id&&teams.includes(a.team)&&teams.includes(b.team)&&a.team!==b.team;}
export function relativeDamageAngle(player,source,yaw=player?.yaw||0){
 if(!player||!source||![player.x,player.z,source.x,source.z,yaw].every(Number.isFinite))return null;
 const dx=source.x-player.x,dz=source.z-player.z;
 if(Math.hypot(dx,dz)<.001)return null;
 return Math.atan2(dx*Math.cos(yaw)-dz*Math.sin(yaw),-dx*Math.sin(yaw)-dz*Math.cos(yaw));
}
export function reloadReadout(player,weapon,item,now){
 const active=!!player?.alive&&finite(player.reloadUntil)>now&&finite(weapon?.reload)>0;
 const remaining=active?Math.max(0,player.reloadUntil-now):0;
 const magazine=finite(weapon?.magazine),ammo=item?.ammo;
 return {active,remaining,progress:active?clamp(1-remaining/weapon.reload,0,1):0,
   low:!!player?.alive&&!active&&magazine>0&&Number.isFinite(ammo)&&ammo<=Math.max(1,Math.floor(magazine*.2))};
}
export function scoreboardRows(game){
 return (game?.actors||[]).filter(a=>teams.includes(a.team)).map(a=>({
   id:String(a.id),name:String(a.name||a.id),team:a.team,player:!!a.isPlayer,alive:!!a.alive,
   kills:Math.max(0,Math.floor(finite(a.kills))),deaths:Math.max(0,Math.floor(finite(a.deaths))),
   assists:Math.max(0,Math.floor(finite(a.combat?.assists))),points:Math.max(0,Math.floor(finite(a.combat?.points))),
   damage:Math.max(0,Math.round(finite(a.combat?.damage))),best:Math.max(0,Math.floor(finite(a.combat?.bestStreak)))
 })).sort((a,b)=>teams.indexOf(a.team)-teams.indexOf(b.team)||b.points-a.points||b.kills-a.kills||a.id.localeCompare(b.id));
}
export function eligibleAlly(actor,player){return !!actor?.alive&&!!player?.alive&&actor.id!==player.id&&actor.team===player.team&&teams.includes(actor.team);}
export class CombatFeedback {
 constructor(){this.reset();}
 reset(){this.hit=null;this.directions=[];this.medal=null;this.queue=[];this.seen=new Set();this.order=[];}
 clearLife(){this.hit=null;this.directions=[];this.medal=null;this.queue=[];}
 handle(events,game){
   const p=game?.player;if(!p)return;
   for(const e of events){
     if(!e||!Number.isFinite(e.time))continue;
     if(e.type==='round'){this.reset();continue;}
     if(Number.isFinite(e.serial)){
       const key=e.type+':'+e.serial;if(this.seen.has(key))continue;
       this.seen.add(key);this.order.push(key);
       if(this.order.length>128)this.seen.delete(this.order.shift());
     }
     if(e.type==='respawn'&&e.actorId===p.id){this.clearLife();continue;}
     if(e.type==='kill'&&e.actorId===p.id){this.directions=[];this.hit=null;continue;}
     if(e.type==='combat-hit'&&e.actorId===p.id&&e.amount>0){
       const target=game.actors.find(a=>a.id===e.targetId);
       if(!hostile(p,target))continue;
       const kind=e.lethal?'kill':e.head?'head':'body',rank={body:1,head:2,kill:3};
       if(!this.hit||this.hit.until<e.time||rank[kind]>=rank[this.hit.kind])
         this.hit={kind,head:!!e.head,until:e.time+(e.lethal?.65:.40),label:e.lethal?(e.head?'HUVUDTRÄFF · UTSLAGEN':'UTSLAGEN'):e.head?'HUVUDTRÄFF':'TRÄFF'};
     }
     if(e.type==='damage'&&e.actorId===p.id&&e.amount>0){
       const shooter=game.actors.find(a=>a.id===e.sourceId);
       if(!hostile(p,shooter))continue;
       // Snapshot the shot's actual origin. Never track the attacker through walls.
       const origin=e.sourcePosition;
       if(!origin||![origin.x,origin.z].every(Number.isFinite))continue;
       this.directions=this.directions.filter(d=>d.id!==e.sourceId&&d.until>e.time);
       this.directions.push({id:e.sourceId,x:origin.x,z:origin.z,until:e.time+1.6});
       if(this.directions.length>4)this.directions.shift();
     }
     if(e.type==='combat-medal'&&e.actorId===p.id&&['kill','assist'].includes(e.kind)){
       const item={title:String(e.title||'ELIMINATION').slice(0,60),detail:String(e.detail||'').slice(0,80),
         points:Math.max(0,Math.floor(finite(e.points))),kind:e.kind,at:e.time};
       if(e.kind==='kill'){this.medal={...item,until:e.time+2.4};this.queue=[];}
       else if(!this.medal||this.medal.until<=e.time)this.medal={...item,until:e.time+1.8};
       else {this.queue.push(item);if(this.queue.length>2)this.queue.shift();}
     }
   }
 }
 tick(time){
   if(this.hit?.until<=time)this.hit=null;
   this.directions=this.directions.filter(d=>d.until>time);
   if(this.medal?.until<=time)this.medal=null;
   this.queue=this.queue.filter(m=>time-m.at<4);
   if(!this.medal&&this.queue.length)this.medal={...this.queue.shift(),until:time+1.8};
 }
}
