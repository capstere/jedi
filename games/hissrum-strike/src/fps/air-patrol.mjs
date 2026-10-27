/** Proactive patrols above the real Hissrum floor. No teleportation, health
 * bonuses or hidden enemy coordinates. The normal Game capsule owns movement.
 * Expensive route checks are bounded and staggered, never done every frame.
 */
export const AIR_PATROL = Object.freeze({
  minHeight: 6, maxHeight: 10, minLeg: 12, maxLeg: 24,
  minDuration: 14, planInterval: 1.1, maxChecks: 320, maxCandidates: 8,
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const snapshot=p=>({x:p.x,y:p.y??0,z:p.z});
const angular=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

/** Only observed snapshots. Never inspect an unseen enemy's current position. */
export function patrolContact(bot,now){
  const record=bot.target?.visible?bot.target:bot.investigation;
  if(finite(record?.lastSensedPosition)){
    const at=record.lastSeenAt??record.timeLastSensed;
    if(record.visible || Number.isFinite(at)&&now>=at&&now-at<=5.5)
      return snapshot(record.lastSensedPosition);
  }
  const shared=bot.sharedContact;
  return finite(shared)&&Number.isFinite(shared.at)&&now>=shared.at&&now-shared.at<=5.5
    ?snapshot(shared):null;
}
function budget(world,actor){
  return {left:AIR_PATROL.maxChecks,used:0,
    clear(x,y,z){
      if(this.left<=0)return false;
      this.left--;this.used++;
      return world.canOccupy(x,z,actor.radius||.2,Math.max(1.7,actor.height||1.7),y);
    }};
}
/** Small swept-capsule samples plus center LOS; actual movement still sweeps
 * at the normal engine resolution. A center ray alone is not body clearance. */
function corridor(world,check,a,b){
  if(world.segmentClear && !world.segmentClear(
    {x:a.x,y:a.y+.85,z:a.z},{x:b.x,y:b.y+.85,z:b.z},{vision:false}))return false;
  const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  const n=Math.max(1,Math.ceil(length/.38));
  if(n>check.left)return false;
  for(let i=1;i<=n;i++){
    const f=i/n;
    if(!check.clear(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,a.z+(b.z-a.z)*f))return false;
  }
  return true;
}
function headroom(world,actor){
  const h=Math.max(1.7,actor.height||1.7);
  let max=Math.min(AIR_PATROL.maxHeight,(world.bounds?.max?.y??12)-h-.4);
  if(world.raycast){
    const from={x:actor.x,y:actor.y+h+.04,z:actor.z};
    const hit=world.raycast(from,{x:0,y:1,z:0},Math.max(0,max-actor.y)+.5);
    if(hit)max=Math.min(max,actor.y+hit.distance-.38);
  }
  return Math.max(0,max);
}
function spacingPenalty(game,actor,p){
  let penalty=0;
  for(const other of game.actors){
    // Friendly spacing is available team knowledge, not enemy omniscience.
    if(other===actor||!other.alive||other.team!==actor.team)continue;
    if(Math.abs((other.y||0)-p.y)<2.2)penalty+=Math.max(0,3.5-distance(other,p))*3;
    const goal=other.airPatrol?.waypoint;
    if(goal)penalty+=Math.max(0,5-distance(goal,p))*2;
  }
  return penalty;
}
/** Make a committed, long leg across the room. Overhead beams and shelves
 * are checked for the climb and for the full horizontal flight segment. */
export function planAirLeg(game,actor,state,contact=null,retreat=false){
  const world=game.world,check=budget(world,actor),start=snapshot(actor);
  const limit=headroom(world,actor);
  const preferred=6.4+((actor.index+state.leg)%4)*1.05;
  const heights=[Math.min(limit,preferred),Math.min(limit,4.4),Math.min(limit,2.0)];
  const nodes=world.navigation?.nodes||[];
  const heading=(state.leg*.93+actor.index*1.37+(actor.team==='analysts'?0:Math.PI));
  const currentRange=contact?distance(actor,contact):0;
  for(const y of new Set(heights)){
    if(y<.65||!check.clear(actor.x,y,actor.z))continue;
    const atHeight={x:actor.x,y,z:actor.z};
    if(!corridor(world,check,start,atHeight))continue;
    const scored=[];
    for(const node of nodes){
      const d=distance(actor,node);
      if(d<6||d>AIR_PATROL.maxLeg)continue;
      const edge=Math.min(node.x-world.bounds.min.x,world.bounds.max.x-node.x,
        node.z-world.bounds.min.z,world.bounds.max.z-node.z);
      if(edge<.8)continue;
      const p={x:node.x,y,z:node.z};
      let score=-Math.abs(d-18)*.65+(d>=AIR_PATROL.minLeg?3:0)
        +Math.cos(Math.atan2(node.x-actor.x,node.z-actor.z)-heading)*2
        -spacingPenalty(game,actor,p);
      if(state.previous)score-=Math.max(0,8-distance(p,state.previous))*1.3;
      if(contact){
        const range=distance(p,contact);
        const cross=Math.abs((p.x-actor.x)*(contact.z-actor.z)-(p.z-actor.z)*(contact.x-actor.x))/Math.max(1,currentRange);
        score-=Math.abs(range-(retreat?21:16))*.65;
        score+=Math.min(8,cross)*.4;
        if(range<8)score-=(8-range)*3;
        if(retreat)score+=clamp(range-currentRange,-8,8)*1.2;
      }
      scored.push({point:p,score});
    }
    scored.sort((a,b)=>b.score-a.score);
    // Diversify shortlist spatially so one cart cannot reject every candidate.
    const shortlist=[];
    for(const entry of scored){
      if(shortlist.some(v=>distance(v.point,entry.point)<3))continue;
      shortlist.push(entry);if(shortlist.length===AIR_PATROL.maxCandidates)break;
    }
    for(const {point} of shortlist){
      if(!check.clear(point.x,point.y,point.z))continue;
      if(!corridor(world,check,atHeight,point))continue;
      return {point,checks:check.used,distance:distance(actor,point)};
    }
    if(check.left<12)break;
  }
  return {point:null,checks:check.used,distance:0};
}
function planLanding(game,actor,state){
  const world=game.world,check=budget(world,actor),here=snapshot(actor);
  const options=[{x:actor.x,z:actor.z},...(world.navigation?.nodes||[])
    .filter(n=>distance(actor,n)<16).sort((a,b)=>distance(actor,a)-distance(actor,b))];
  const tried=[];
  for(const node of options){
    if(tried.some(p=>distance(p,node)<1.2))continue;
    tried.push(node);if(tried.length>AIR_PATROL.maxCandidates)break;
    const upper={x:node.x,y:actor.y,z:node.z},floor={...upper,y:0};
    if(!check.clear(node.x,0,node.z))continue;
    if(!corridor(world,check,here,upper)||!corridor(world,check,upper,floor))continue;
    state.lastPlanChecks=check.used;
    return floor;
  }
  state.lastPlanChecks=check.used;
  return null;
}
function chooseLeg(game,actor,state,contact,retreat,now){
  const plan=planAirLeg(game,actor,state,contact,retreat);
  state.nextPlan=now+AIR_PATROL.planInterval;
  state.lastPlanChecks=plan.checks;state.plans++;
  if(!plan.point)return false;
  state.previous=snapshot(actor);state.waypoint=plan.point;
  state.goalY=plan.point.y;state.leg++;state.lastProgress=now;
  state.lastPosition=snapshot(actor);state.legDistance=plan.distance;
  state.retreat=retreat;
  return true;
}

export function updateAirPatrol(game,actor,input,dt){
  const now=game.state.time,bot=actor.bot;
  if(!bot||!actor.alive||!game.config.botFlight)return input;
  let state=actor.airPatrol;
  if(!state?.proactive){
    state=actor.airPatrol={proactive:true,mode:'ground',leg:0,plans:0,
      nextAt:now+.45+(actor.index%5)*.24+(actor.team==='analysts'?0:.13),
      nextPlan:now,waypoint:null,previous:null,goalY:0,until:0,
      lastProgress:now,lastPosition:snapshot(actor),peakY:0,distance:0,
      legDistance:0,lastPlanChecks:0,retreat:false,lastEvade:-Infinity};
  }
  if(!actor.flying&&state.mode!=='ground'){
    state.mode='ground';state.waypoint=null;state.nextAt=now+1.1;
    state.nextPlan=now;state.retreat=false;
  }
  const contact=patrolContact(bot,now);
  const urgent=!!actor.action||game.bomb?.carrierId===actor.id||
    game.bomb?.status==='planted'||game.hostages?.some(h=>h.escortId===actor.id);
  const recentHit=Number.isFinite(actor.hurtTime)&&now>=actor.hurtTime&&now-actor.hurtTime<1.8;
  const evade=!!contact&&(recentHit||actor.hp<38||actor.reloadUntil>now);
  const progress=Math.hypot(actor.x-state.lastPosition.x,actor.y-state.lastPosition.y,actor.z-state.lastPosition.z);
  if(progress>.02)state.lastProgress=now;
  state.distance+=distance(actor,state.lastPosition);state.peakY=Math.max(state.peakY,actor.y);
  state.lastPosition.x=actor.x;state.lastPosition.y=actor.y;state.lastPosition.z=actor.z;
  if(state.mode==='ground'){
    if(urgent||now<state.nextAt)return input;
    const count=game.actors.filter(a=>a.bot&&a.alive&&a.flying).length;
    if(count>=(game.config.maxFlyingBots??4))return input;
    // Give the longest-waiting bot the next free slot, not always the first
    // actor in Game's array. Failed climbs defer their ticket to the next bot.
    const older=game.actors.some(a=>a!==actor&&a.bot&&a.alive&&!a.flying
      &&a.airPatrol?.proactive&&a.airPatrol.mode==='ground'
      &&a.airPatrol.nextAt<state.nextAt-1e-6&&!a.action
      &&game.bomb?.carrierId!==a.id&&!game.hostages?.some(h=>h.escortId===a.id));
    if(older)return input;
    if(!chooseLeg(game,actor,state,contact,evade,now)){
      state.nextAt=now+1.3;return input; // Keep ordinary ground AI, never teleport.
    }
    state.mode='flight';state.until=now+AIR_PATROL.minDuration+(actor.index%4)*1.6;
    actor.flying=true;actor.vy=0;actor.onGround=false;
    game.emit?.('bot-takeoff',actor,{altitude:state.goalY});
  }
  if(state.mode==='flight'&&(urgent||now>=state.until)){
    state.mode='landing';state.waypoint=null;state.nextPlan=now;
  }
  if(state.mode==='landing'){
    if(actor.y<=.025){
      actor.flying=false;actor.onGround=true;actor.vy=0;
      state.mode='ground';state.waypoint=null;
      state.nextAt=now+4+(actor.index%3)*.6;
      input.jump=false;input.crouch=false;
      game.emit?.('bot-landed',actor);return input;
    }
    if(now>=state.nextPlan&&(!state.waypoint||now-state.lastProgress>1.3)){
      state.waypoint=planLanding(game,actor,state);
      state.nextPlan=now+AIR_PATROL.planInterval;state.lastProgress=now;
    }
  }else if(now>=state.nextPlan){
    const reached=state.waypoint&&distance(actor,state.waypoint)<.9&&Math.abs(actor.y-state.goalY)<.25;
    const stuck=now-state.lastProgress>1.2;
    if(!state.waypoint||reached||stuck||(evade&&now-state.lastEvade>2.5)){
      if(chooseLeg(game,actor,state,contact,evade,now)){
        if(evade)state.lastEvade=now;
      }else{
        state.waypoint=null;
        // A blocked flight gives way to a validated landing, never a clip-through.
        state.mode='landing';state.nextPlan=now;
      }
    }
  }
  const waypoint=state.waypoint;
  input.moveWorld={x:0,z:0};input.jump=false;input.crouch=false;input.sneak=false;
  if(!waypoint)return input;
  const remaining=distance(actor,waypoint),speed=game.config.botFlySpeed??4.5;
  const landing=state.mode==='landing';
  const altitude=landing?(remaining<.45?0:actor.y):waypoint.y;
  const dy=altitude-actor.y;
  input.jump=dy>.12;input.crouch=dy<-.12;
  // Climb in a verified column before crossing furniture. A wide patrol leg,
  // not alternating left/right micro-strafes, determines subsequent movement.
  const climbing=!landing&&Math.abs(dy)>.4;
  const firingWindow=!evade&&!!bot.target?.visible&&!climbing&&(now+actor.index*.31)%3.4<.22;
  if(remaining>.35&&!climbing&&!firingWindow){
    const step=Math.min(speed*dt,remaining);
    input.moveWorld={x:(waypoint.x-actor.x)/remaining*step,z:(waypoint.z-actor.z)/remaining*step};
  }
  if(evade||climbing||!bot.target?.visible)input.fire=false;
  if(!bot.target?.visible){
    const heading=Math.atan2(-(waypoint.x-actor.x),-(waypoint.z-actor.z));
    input.yaw=(actor.yaw||0)+clamp(angular(heading,actor.yaw||0),-2.8*dt,2.8*dt);
    input.pitch=(actor.pitch||0)+clamp(-.23-(actor.pitch||0),-1.4*dt,1.4*dt);
  }
  actor.aiState=landing?'söker säker landning':evade?'bryter undan':climbing?'stiger till flyghöjd':contact?'byter anfallsvinkel':'spanar över rummet';
  return input;
}
