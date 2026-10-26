/**
 * Small tactical planner for the real Hissrum 12 GLB.
 *
 * No omniscience: enemy locations are supplied only by an AI's Yuka visual
 * memory or a teammate's recent *observed* contact. No hidden live actors.
 * Candidate cover, firing positions and routes come from the original GLB
 * collision-tested navigation graph. Bounded searches run on decision ticks,
 * never once per render frame.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const distance2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const eye=(p,h=1.7)=>({x:p.x,y:(p.y||0)+h-.19,z:p.z});
export const TACTICAL_ROLES=Object.freeze(['hold','flank','support','hold','flank']);

export function latestSquadContact(game,actor,maxAge=5.5){
 const now=game.state?.time??0;
 const list=(game.tacticalContacts||[]).filter(c=>c.team===actor.team
   &&Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.at)
   &&now>=c.at&&now-c.at<=maxAge
   &&(!game.world?.inside||game.world.inside(c.x,c.z,.2)));
 if(!list.length)return null;
 // Score only actually-reported sightings. Recency dominates; prefer local
 // contacts if equally fresh, so squads can respond independently.
 list.sort((a,b)=>(b.at-a.at)*4+distance2(actor,a)*.06-distance2(actor,b)*.06);
 return {x:list[0].x,z:list[0].z,y:1.0,at:list[0].at,source:'team'};
}
export function chooseTactic(actor,now,urgent=false){
 if(urgent)return 'objective';
 if(actor.reloadUntil>now || actor.hp<43 &&
   (now-(actor.hurtTime??-Infinity)<4.0 || actor.hp<24))return 'cover';
 return TACTICAL_ROLES[actor.index%TACTICAL_ROLES.length];
}
export function tacticalRange(weapon){
 if(weapon==='shotgun'||weapon==='knife')return 4.5;
 if(weapon==='sniper')return 14;
 if(weapon==='smg')return 6.7;
 return 9.0;
}
function allyPenalty(game,actor,point){
 let penalty=0;
 for(const ally of game.actors||[]){
   if(!ally.alive||ally===actor||ally.team!==actor.team)continue;
   const d=distance2(ally,point);
   if(d<3.5)penalty+=(3.5-d)*1.7;
   const goal=ally.bot?.tactical?.point;
   if(goal && ally.bot.tactical.until>game.state.time){
     const g=distance2(goal,point);
     if(g<3.5)penalty+=(3.5-g)*2.0;
   }
 }
 return penalty;
}
function sideOffset(actor,p,target){
 const dx=target.x-actor.x,dz=target.z-actor.z,span=Math.hypot(dx,dz)||1;
 return Math.abs((p.x-actor.x)*dz-(p.z-actor.z)*dx)/span;
}

/** Candidate scoring is pure except for visibility checks against the REAL
 * geometry. Mode cover actively prefers *occluded* positions; flank seeks a
 * different firing lane; hold resists chasing across the entire room.
 */
export function scoreTacticalPosition(game,actor,point,target,mode){
 const world=game.world,range=tacticalRange(actor.weapon),travel=distance2(actor,point),
   targetRange=distance2(point,target);
 if(!Number.isFinite(targetRange)||targetRange<1.35 || travel>13.5)return -Infinity;
 const pointEye=eye(point,actor.height||1.7),lastSeenEye=eye(target,.9);
 const exposed=world.segmentClear(lastSeenEye,pointEye,{vision:false})!==false;
 const fireLane=world.segmentClear(pointEye,lastSeenEye,{vision:false})!==false;
 const sideways=sideOffset(actor,point,target);
 let score=-travel*.30-Math.abs(targetRange-range)*.36-allyPenalty(game,actor,point);
 if(mode==='cover'){
   score+=exposed?-8:10;
   score-=Math.max(0,6-targetRange)*1.1;
 }else if(mode==='flank'){
   score+=fireLane?6:-2;
   score+=Math.min(8,sideways)*.85;
   if(sideways<1.3)score-=3.4;
 }else if(mode==='support'){
   score+=fireLane?4:-1;
   score+=!exposed?4:0;
   score+=Math.min(5,sideways)*.24;
 }else if(mode==='investigate'){
   score+=Math.min(sideways,5)*.75;
   score-=Math.max(0,targetRange-7)*.28;
 }else{ // hold (longer-distance, aimed defense from a stable lane)
   score+=fireLane?5:-3;
   score+=!exposed?2:0;
   score-=travel*.22;
 }
 return score;
}

export function planTacticalPosition(game,actor,known,mode,{maxCandidates=28}={}){
 if(!known||!Number.isFinite(known.x)||!Number.isFinite(known.z))return null;
 const world=game.world,nodes=world.navigation?.nodes||[];
 if(!nodes.length||!['hold','flank','support','cover','investigate'].includes(mode))return null;
 const range=tacticalRange(actor.weapon);
 // Cheap preselection with a strict cap before expensive line-of-fire and
 // connected-path checks. 10 bots on iPhone must never scan every path.
 const shortlisted=[];
 for(const node of nodes){
   const travel=distance2(actor,node),d=distance2(node,known);
   if(travel>12.5||d<1.45||d>23)continue;
   if(!world.canOccupy(node.x,node.z,actor.radius||.2,actor.height||1.7,0))continue;
   const lateral=sideOffset(actor,node,known);
   const raw=travel*.38+Math.abs(d-range)*.4-
     (mode==='flank'?Math.min(lateral,7)*.7:mode==='investigate'?Math.min(lateral,5)*.35:0);
   shortlisted.push({node,raw});
 }
 shortlisted.sort((a,b)=>a.raw-b.raw);
 const ranked=shortlisted.slice(0,clamp(maxCandidates,4,40))
  .map(v=>({point:v.node,score:scoreTacticalPosition(game,actor,v.node,known,mode)}))
  .filter(v=>Number.isFinite(v.score)).sort((a,b)=>b.score-a.score);
 for(const c of ranked.slice(0,7)){
   // Never issue an unreachable goal. world.findPath uses the GLB-swept
   // capsule and same wall/door collision rules as players.
   const route=world.findPath(actor,c.point);
   if(!Array.isArray(route)||!route.length)continue;
   let prev=actor,length=0;
   for(const p of route){length+=distance2(prev,p);prev=p;}
   if(length>32)continue;
   return {x:c.point.x,z:c.point.z,score:c.score-length*.07,role:mode,
     travelLength:length,source:'observed-contact'};
 }
 return null;
}
