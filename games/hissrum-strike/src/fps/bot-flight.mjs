/** Hissrum 12 bot flight: tactical, bounded and collision-aware.
 * The original Cartridge Strike bot controller still chooses its route,
 * aim and target. Flight only adds a vertical plan over the same real GLB
 * capsule collision volume; never teleports, ignores geometry or sees through
 * walls. All bots can take turns flying, with a mobile-safe simultaneous cap.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function updateBotFlight(game,actor,input,dt){
 if(!actor.bot||!actor.alive||!game.config.botFlight)return input;
 const now=game.state.time,world=game.world;
 const state=actor.airPatrol??={mode:'ground',nextAt:2+actor.index*.79+(actor.team==='counterAnalysts'?1.3:0),until:0,goalY:0,landSince:0};
 // Respawn and fresh rounds force flying=false. Clear any interrupted patrol
 // so an AI killed during descent can still take off in subsequent rounds.
 if(!actor.flying&&state.mode!=='ground'){
   state.mode='ground';state.goalY=0;state.nextAt=now+3.5;
 }
 const urgent=!!actor.action || game.bomb?.carrierId===actor.id ||
   game.bomb?.status==='planted' || game.hostages?.some(h=>h.escortId===actor.id);
 const flyingBots=game.actors.filter(a=>a.bot&&a.alive&&a.flying).length;
 // A flight patrol is useful when seeking a firing angle or overcoming a
 // blocked ground route. The release interval is intentionally staggered.
 if(state.mode==='ground'&&now>=state.nextAt&&!urgent&&flyingBots<4){
   const climb=.34;
   const safe=world.canOccupy(actor.x,actor.z,actor.radius,actor.height,Math.max(climb,actor.y+climb));
   if(safe){
     state.mode='flight';
     state.goalY=clamp(1.25+(actor.index%3)*.60,1.0,3.0);
     state.until=now+4.3+(actor.index%3)*1.1;
     actor.flying=true;actor.vy=0;actor.onGround=false;
     game.emit?.('bot-takeoff',actor,{altitude:state.goalY});
   }else state.nextAt=now+3;
 }
 if(state.mode==='flight'&&(now>=state.until||urgent)){
   state.mode='landing';state.goalY=0;state.landSince=now;
 }
 if(!actor.flying)return input;
 // Maintain horizontal Yuka navigation; it always follows real walkable
 // nodes, even when a bot temporarily travels above them.
 input.jump=state.mode==='flight'&&actor.y<state.goalY-.12;
 input.crouch=state.mode==='landing' || actor.y>state.goalY+.12;
 // Moving over a cart could make the floor under the capsule non-walkable.
 // Head to the nearest validated ground node *by walking*, not teleporting.
 if(state.mode==='landing'){
   const landing=world.navigation?.nearest(actor);
   if(landing&&!world.canOccupy(actor.x,actor.z,actor.radius,actor.height,0)){
     const dx=landing.x-actor.x,dz=landing.z-actor.z,len=Math.hypot(dx,dz);
     if(len>.13){
       const pace=(game.config.botSpeed??3.15)*dt;
       input.moveWorld={x:dx/len*Math.min(pace,len),z:dz/len*Math.min(pace,len)};
     }
   }
   if(actor.y<=.025){
     actor.y=0;actor.flying=false;actor.onGround=true;actor.vy=0;
     state.mode='ground';state.nextAt=now+7.5+(actor.index%4)*1.5;
     game.emit?.('bot-landed',actor);
   }
 }
 return input;
}
