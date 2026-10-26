import {neutralOpening} from './control-deployment.mjs';
/** Authoritative, bounded session scoring and optional public-area objective.
 * No hidden enemy tracking, damage multipliers, real identities or persistent accounts. */
const teams=['analysts','counterAnalysts'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const position=a=>({x:a.x,y:(a.y||0)+.85,z:a.z});
const hostile=(a,b)=>a&&b&&a!==b&&teams.includes(a.team)&&teams.includes(b.team)&&a.team!==b.team;
const fresh=()=>({points:0,assists:0,streak:0,bestStreak:0,chain:0,lastKill:-Infinity,damage:0,hits:0,headHits:0,captures:0,incoming:{},recap:null});
function resetLife(a){a.combat??=fresh();Object.assign(a.combat,{streak:0,chain:0,lastKill:-Infinity,incoming:{},recap:null});}
function medal(g,a,title,detail,points=0,kind='kill'){
 a.combat.points+=points;
 g.emit('combat-medal',a,{title,detail,points,kind,streak:a.combat.streak});
}
export function createControlZones(world){
 if(!world.navigation?.nodes?.length)return [];
 const home=world.anchors.analysts[0],other=world.anchors.counterAnalysts[0],zones=[];
 // Only already accepted navigable spaces. Never invent a doorway or use the
 // hostage/buy anchors as a capture point. Map room names remain authoritative.
 for(const id of ['I01','I26','I12']){
  const nodes=world.navigation.nodes.filter(n=>world.roomAt(n.x,n.z)?.id===id&&world.canOccupy(n.x,n.z,.38,1.72,0));
  if(!nodes.length)continue;
  const centre={x:nodes.reduce((s,n)=>s+n.x,0)/nodes.length,z:nodes.reduce((s,n)=>s+n.z,0)/nodes.length};
  nodes.sort((a,b)=>distance(a,centre)-distance(b,centre));
  const node=nodes.find(n=>distance(n,home)>3&&distance(n,other)>3&&world.findPath(home,n).length&&world.findPath(other,n).length);
  if(node)zones.push({id,name:world.roomAt(node.x,node.z).name,x:node.x,y:0,z:node.z,radius:2.8});
 }
 const opening=neutralOpening(world);if(opening)zones.unshift(opening);
 return zones;
}
export function initializeCombat(g){
 g.combatSpawnPools=new Map();g.combatGoalPools=new Map();
 for(const a of g.actors)resetLife(a);
 const zones=g.state.mode==='endless'&&g.config.firefight===true?createControlZones(g.world):[];
 g.state.combatFlow={zones,index:0,rotateAt:g.state.time+60,owner:null,capturing:null,progress:0,contested:false,occupants:[],hold:0,scores:{analysts:0,counterAnalysts:0},firstKill:false};
}
export function activeControl(g){return g.state.combatFlow?.zones[g.state.combatFlow.index]||null;}
export function tickCombat(g,dt){
 const f=g.state.combatFlow,z=activeControl(g);
 if(!f||!z||g.phase!=='active'||g.state.paused)return;
 if(g.state.time>=f.rotateAt){
  f.index=(f.index+1)%f.zones.length;f.rotateAt=g.state.time+60;
  Object.assign(f,{owner:null,capturing:null,progress:0,contested:false,occupants:[],hold:0});
  g.emit('control-moved',null,{...activeControl(g),nextAt:f.rotateAt});return;
 }
 const inside=g.actors.filter(a=>a.alive&&a.onGround!==false&&a.spawnProtectedUntil<=g.state.time&&distance(a,z)<=z.radius&&g.world.segmentClear(position(a),{...z,y:.85},{vision:false}));
 f.occupants=inside.map(a=>a.id);const sides=new Set(inside.map(a=>a.team));f.contested=sides.size>1;
 if(sides.size!==1){f.capturing=null;f.progress=0;f.hold=0;return;}
 const side=inside[0].team;
 if(f.owner!==side){
  if(f.capturing!==side){f.capturing=side;f.progress=0;}
  f.progress=Math.min(1,f.progress+dt/3);f.hold=0;
  if(f.progress>=1-1e-7){
   f.owner=side;f.capturing=null;f.progress=0;
   // Captures affect the independent control score, NOT the enemy-kill score.
   f.scores[side]+=5;
   for(const a of inside){a.combat.captures++;medal(g,a,'OMRÅDE SÄKRAT',z.name,75,'capture');}
   g.emit('control-captured',null,{...z,team:side});
  }
 }else{
  f.capturing=null;f.progress=0;f.hold+=dt;
  if(f.hold>=1){const n=Math.floor(f.hold);f.scores[side]+=n;f.hold-=n;}
 }
}
export function combatEvent(g,e){
 const f=g.state.combatFlow;if(!f)return;
 const victim=g.actors.find(a=>a.id===e.actorId),source=g.actors.find(a=>a.id===e.sourceId);
 if(e.type==='respawn'&&victim){resetLife(victim);return;}
 if(e.type==='damage'&&victim&&e.amount>0&&source){
  const c=victim.combat;
  const record=c.incoming[source.id]||{amount:0,hits:0,last:0,weapon:e.weapon,recent:[]};
  record.amount+=e.amount;record.hits++;record.last=e.time;record.weapon=e.weapon;
  record.recent=(record.recent||[]).filter(hit=>e.time-hit.at<=8);
  record.recent.push({at:e.time,amount:e.amount});
  if(record.recent.length>128)record.recent.splice(0,record.recent.length-128);
  c.incoming[source.id]=record; // at most ten actor keys per life
 }
 if(e.type==='damage'&&hostile(source,victim)){
  source.combat.damage+=e.amount;source.combat.hits++;
  const head=Number.isFinite(e.point?.y)&&e.point.y>=victim.y+victim.height*.83;
  if(head)source.combat.headHits++;
  g.emit('combat-hit',source,{head,amount:e.amount,targetId:victim.id,lethal:e.hp<=0});
 }
 if(e.type!=='kill')return;
 if(victim){
  const received=victim.combat.incoming;
  victim.combat.recap={attacker:source?.name||e.sourceName||'Miljön',weapon:e.weapon,
   distance:source?Math.round(distance(source,victim)):null,
   damage:Math.round(Object.values(received).reduce((s,r)=>s+r.amount,0)),hits:Object.values(received).reduce((s,r)=>s+r.hits,0),
   streak:victim.combat.streak,at:e.time};
  victim.combat.streak=0;victim.combat.chain=0;
 }
 if(!hostile(source,victim)){
  if(source){source.combat.streak=0;source.combat.chain=0;source.combat.lastKill=-Infinity;}
  return; // no medals, points, assists or success sounds for allies/hostages/self
 }
 const c=source.combat;c.streak++;c.bestStreak=Math.max(c.bestStreak,c.streak);
 c.chain=e.time-c.lastKill<=4.5?Math.min(5,c.chain+1):1;c.lastKill=e.time;
 let title=c.chain>=3?'TRIPLE ELIMINATION':c.chain===2?'DOUBLE ELIMINATION':'ELIMINATION';
 if([3,5,10].includes(c.streak))title=c.streak===3?'PÅ GÅNG · 3 I RAD':c.streak===5?'DOMINERAR · 5 I RAD':'OSTOPPBAR · 10 I RAD';
 const first=!f.firstKill;f.firstKill=true;
 if(first&&c.chain===1)title='FÖRSTA ELIMINATIONEN';
 medal(g,source,title,`${victim.name} · ${c.streak} i rad`,100,'kill');
 for(const [id,r]of Object.entries(victim.combat.incoming)){
  const a=g.actors.find(a=>a.id===id);
  if(a&&a!==source&&a.team===source.team&&(r.recent||[]).filter(hit=>e.time-hit.at<=8).reduce((n,hit)=>n+hit.amount,0)>=20){a.combat.assists++;medal(g,a,'ASSIST',victim.name,35,'assist');}
 }
}
/** Public goal shared by both teams; actual combat still needs normal perception. */
export function controlObjective(bot){
 const g=bot.game,a=bot.actor,f=g.state.combatFlow;let z=activeControl(g);
 // Slots 1/2 are bots on BOTH sides; slot 0 may be the human player.
 // Preparing the next PUBLIC goal never reveals enemy locations.
 if(z&&(a.index===1||a.index===2)&&f.rotateAt-g.state.time<=10)z=f.zones[(f.index+1)%f.zones.length];
 if(!z)return false;
 // One roaming flank per team avoids sending every bot into the same doorway.
 if(a.index===4)return false;
 let candidates=g.combatGoalPools.get(z.id);
 if(!candidates){candidates=g.world.navigation.nodes.filter(n=>distance(n,z)<2.4&&distance(n,z)>.5&&g.world.segmentClear({...n,y:.85},{...z,y:.85},{vision:false}));g.combatGoalPools.set(z.id,candidates);}
 const target=candidates.length?candidates[(a.index*7+(a.team==='analysts'?0:3))%candidates.length]:z;
 if(distance(a,target)>.3)bot.setGoal(target);else bot.setGoal(null);
 a.aiState='kontrollområde';return true;
}
/** Candidate spawn positions, never targeting data. First deployment is unchanged. */
export function combatSpawnCandidates(g,a){
 const zone=activeControl(g);if(!zone)return [];
 const key=`${zone.id}:${a.team}`;g.combatSpawnPools??=new Map();
 if(g.combatSpawnPools.has(key))return g.combatSpawnPools.get(key);
 const home=g.world.anchors[a.team][0],dx=home.x-zone.x,dz=home.z-zone.z;
 const nodes=g.world.navigation.nodes.filter(n=>{const d=distance(n,zone);return d>=9&&d<=17&&(n.x-zone.x)*dx+(n.z-zone.z)*dz>0;});
 const stride=Math.max(1,Math.ceil(nodes.length/32));
 const pool=nodes.filter((_,i)=>i%stride===0).filter(n=>g.world.canOccupy(n.x,n.z,a.radius+.02,a.height,0)&&g.world.findPath(zone,n).length).map(n=>({x:n.x,z:n.z,frontline:true}));
 g.combatSpawnPools.set(key,pool);return pool;
}
