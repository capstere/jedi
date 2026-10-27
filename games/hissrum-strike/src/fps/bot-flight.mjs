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
 const now=game.state.time,world=game.world,agile=game.config.agileFlight===true;
 const state=actor.airPatrol??={mode:'ground',nextAt:(agile?now:0)+(agile?.7:2)+actor.index*(agile?.36:.79)+(actor.team==='counterAnalysts'?.4:0),until:0,goalY:0,landSince:0,nextVantage:0,side:actor.index%2?1:-1};
 // Respawn and fresh rounds force flying=false. Clear any interrupted patrol
 // so an AI killed during descent can still take off in subsequent rounds.
 if(!actor.flying&&state.mode!=='ground'){
   state.mode='ground';state.goalY=0;state.nextAt=now+(agile?1.5:3.5);
 }
 const urgent=!!actor.action || game.bomb?.carrierId===actor.id ||
   game.bomb?.status==='planted' || game.hostages?.some(h=>h.escortId===actor.id);
 const tactical=game.config.tacticalAI===true;
 const bot=actor.bot;
 const contact=bot.target?.visible?bot.target.lastSensedPosition
   :bot.investigation?.lastSensedPosition??bot.sharedContact;
 const role=bot.tactical?.kind;
 const flyingBots=game.actors.filter(a=>a.bot&&a.alive&&a.flying).length;
 // Flight is for scouting and firing-angle changes, not arbitrary hovering.
 // Contacts here are Yuka LAST SIGHTINGS or time-limited squad reports.
 const eye=(y)=>({x:actor.x,y:y+actor.height-.12,z:actor.z});
 const point=contact?{x:contact.x,y:contact.y??1.3,z:contact.z}:null;
 const blocked=point&&world.segmentClear(eye(actor.y),point,{vision:false})===false;
 const hasTactic=role==='flank'||role==='support';
 const scout=(actor.index===3||agile&&actor.index===0)&&!point&&now>state.nextAt+(agile?1.5:4);
 const wantsAltitude=!!point&&(blocked||hasTactic||agile&&actor.index%2===0)||scout;
 const mustLand=tactical&&(role==='cover'||actor.hp<(agile?30:42)||urgent);
 // A flight patrol is useful when seeking a firing angle or overcoming a
 // blocked ground route. The release interval is intentionally staggered.
 if(state.mode==='ground'&&now>=state.nextAt&&!urgent
   &&(!tactical||wantsAltitude)&&!mustLand&&flyingBots<(game.config.maxFlyingBots??(tactical?2:4))){
   const climb=.34;
   const safe=world.canOccupy(actor.x,actor.z,actor.radius,actor.height,Math.max(climb,actor.y+climb));
   if(safe){
     state.mode='flight';
     let desired=clamp(1.25+(actor.index%3)*.60,1.0,3.0);
     if(tactical){
       // Prefer the LOWEST valid elevation opening a legitimate sightline.
       // Never rise through shelves or a ceiling to obtain magical vision.
       const heights=(agile?[1.2,2.4,3.6]:[1.0,1.55,2.2]).filter(y=>world.canOccupy(
         actor.x,actor.z,actor.radius,actor.height,y));
       const vantage=point&&heights.find(y=>world.segmentClear(eye(y),point,{vision:false}));
       desired=vantage??heights[0]??1.0;
     }
     state.goalY=desired;
     state.baseY=desired;state.nextVantage=now+.5;
     state.until=now+(agile?6.5:tactical?3.8:4.3)+(actor.index%3)*(agile?1.2:.9);
     actor.flying=true;actor.vy=0;actor.onGround=false;
     game.emit?.('bot-takeoff',actor,{altitude:state.goalY});
   }else state.nextAt=now+(agile?1.2:3);
 }
 if(state.mode==='flight'&&(now>=state.until||urgent||mustLand)){
   state.mode='landing';state.goalY=0;state.landSince=now;
 }
 if(!actor.flying)return input;
 if(agile&&state.mode==='flight'){
   if(now>=(state.nextVantage??0)){
     state.nextVantage=now+.5;
     const desired=clamp((state.baseY??state.goalY)+Math.sin(now*.85+actor.index)*.42,.75,4.1);
     if(world.canOccupy(actor.x,actor.z,actor.radius,actor.height,desired))state.goalY=desired;
   }
   if(bot.target?.visible&&point&&!urgent){
     const dx=point.x-actor.x,dz=point.z-actor.z,len=Math.hypot(dx,dz);
     if(Math.floor((now+actor.index*.33)/.6)%4===3){
       input.moveWorld={x:0,z:0}; // stable firing interval between strafes
     }else if(len>3&&len<25){
       const side=(Math.floor(now/2.4+actor.index)%2?1:-1);
       const stride=(game.config.botFlySpeed??4.5)*dt*.72;
       const mx=-dz/len*side*stride,mz=dx/len*side*stride;
       if(world.canOccupy(actor.x+mx,actor.z+mz,actor.radius,actor.height,actor.y)){
         const base=input.moveWorld??{x:0,z:0};
         input.moveWorld={x:base.x*.45+mx,z:base.z*.45+mz};
       }
     }
   }else if(input.moveWorld){input.moveWorld.x*=1.22;input.moveWorld.z*=1.22;}
 }

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
     state.mode='ground';state.nextAt=now+(agile?2.8:tactical?9:7.5)+(actor.index%4)*(agile?.55:1.5);
     game.emit?.('bot-landed',actor);
   }
 }
 return input;
}
