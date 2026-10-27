from pathlib import Path
root=Path('games/hissrum-strike/src')
p=root/'fps/game.mjs';s=p.read_text()
def swap(a,b):
 global s
 assert a in s,a[:150]
 s=s.replace(a,b,1)
swap("import {updateBotFlight} from './bot-flight.mjs';", "import {updateBotFlight} from './bot-flight.mjs?v=arsenal-v7';\nimport {rayBody as rayActor,automaticTrigger,resetAutoAim} from './aim-controls.mjs';\nimport {freshRecoil,recoverRecoil,kickRecoil,applyAimRecoil} from './recoil.mjs';\nimport {grenadeLaunch,advanceGrenade} from './grenade-ballistics.mjs';")
start=s.index('function rayActor(');end=s.index('export class Game',start);s=s[:start]+s[end:]
swap("height: this.config.standingHeight, vy: 0, onGround: true, crouching: false, flying: false, reloadUntil: 0,", "height: this.config.standingHeight, vy: 0, onGround: true, crouching: false, flying: false, reloadUntil: 0,\n        aimRecoil:freshRecoil(),rawAimYaw:spawn.yaw??0,rawAimPitch:0,autoAim:null,autoAimProgress:0,airPatrol:null,")
swap("a.fireHeld = false; a.interactHeld = false; a.jumpHeld = false; a.action = null;", "a.fireHeld = false; a.interactHeld = false; a.jumpHeld = false; a.action = null; resetAutoAim(a);")
swap("      actor.recoil *= Math.exp(-8 * dt);", "      actor.recoil *= Math.exp(-8 * dt);\n      if(actor.isPlayer&&this.config.progressiveRecoil)recoverRecoil(actor.aimRecoil??=freshRecoil(),dt,s.time);")
swap("      if (controls.fire) this.fire(actor, !actor.fireHeld);\n      actor.fireHeld = !!controls.fire;", "      if(actor.requireFireRelease&&!controls.fire)actor.requireFireRelease=false;\n      const auto=actor.isPlayer&&automaticTrigger(this,actor,WEAPONS[actor.weapon],controls.autoFire===true&&!actor.requireFireRelease);\n      const trigger=!!controls.fire&&!actor.requireFireRelease||!!auto;\n      if(trigger){\n        const shot=this.fire(actor,auto||!actor.fireHeld);\n        if(shot&&auto&&actor.weapon==='sniper')resetAutoAim(actor);\n      }\n      actor.fireHeld=trigger;")
swap("    if (Number.isFinite(input.yaw)) actor.yaw = input.yaw;\n    if (Number.isFinite(input.pitch)) actor.pitch = clamp(input.pitch, -1.49, 1.49);", "    if(actor.isPlayer&&this.config.progressiveRecoil)applyAimRecoil(actor,input);\n    else{\n      if (Number.isFinite(input.yaw)) actor.yaw = input.yaw;\n      if (Number.isFinite(input.pitch)) actor.pitch = clamp(input.pitch, -1.49, 1.49);\n    }")
swap("const speed = flying ? (this.config.flySpeed ?? 5.8) * (input.sneak ? .55 : 1)","const speed = flying ? (actor.bot?(this.config.botFlySpeed??this.config.flySpeed??5.8):(this.config.flySpeed??5.8)) * (input.sneak ? .55 : 1)")
swap("    if (!actor?.alive || (this.phase !== 'buy' && !(isEndless(this)&&this.phase==='active'))) return reject('Köp är endast öppet under köptiden.');\n    if (!isEndless(this)&&!this.inBuyZone(actor)) return reject('Gå till lagets köpzon.');\n    if (w.team && w.team !== actor.team) return reject('Vapnet tillhör det andra laget.');\n    if (!isEndless(this)&&actor.money < w.cost) return reject('För lite krediter.');", "    const liveShop=!!this.config.liveShop&&!!actor?.isPlayer;\n    const phaseOK=this.phase==='buy'||this.phase==='active'&&(isEndless(this)||liveShop);\n    if(!actor?.alive||!phaseOK)return reject('Du måste vara vid liv under en pågående runda.');\n    if(!liveShop&&!isEndless(this)&&!this.inBuyZone(actor))return reject('Gå till lagets köpzon.');\n    if(w.team&&w.team!==actor.team&&!(liveShop&&this.config.openArsenal))return reject('Vapnet tillhör det andra laget.');\n    const paid=liveShop||!isEndless(this);\n    if(paid&&(!Number.isFinite(actor.money)||actor.money<w.cost))return reject('För lite krediter.');")
swap("    if(!isEndless(this))actor.money -= w.cost;", "    if(paid)actor.money-=w.cost;")
swap("    this.emit('buy', actor, { item: id }); return { ok: true };", "    resetAutoAim(actor);\n    this.emit('buy', actor, { item: id, cost:paid?w.cost:0 }); return { ok: true };")
swap("    actor.lastWeapon = actor.weapon; actor.weapon = id; actor.reloadUntil = 0;", "    resetAutoAim(actor);\n    actor.lastWeapon = actor.weapon; actor.weapon = id; actor.reloadUntil = 0;")
swap("    actor.reloadUntil = this.state.time + w.reload;", "    resetAutoAim(actor);\n    actor.reloadUntil = this.state.time + w.reload;")
swap(" + actor.recoil * .18 + actor.flash * .12;", " + actor.recoil * .18 + actor.flash * .12 + (actor.isPlayer&&this.config.progressiveRecoil?(actor.aimRecoil?.heat||0)*.0012:0);")
swap("    if(w.projectile){launchRocket(this,actor,direction(actor.yaw,actor.pitch));return true;}", "    if(w.projectile){launchRocket(this,actor,direction(actor.yaw,actor.pitch));this.applyShotRecoil(actor);return true;}")
swap("    return true;\n  }\n  damage(target, amount, source", "    this.applyShotRecoil(actor);\n    return true;\n  }\n  applyShotRecoil(actor){\n    if(!actor.isPlayer||!this.config.progressiveRecoil)return;\n    applyAimRecoil(actor,{});\n    kickRecoil(actor.aimRecoil,actor.weapon,this.state.time);\n    applyAimRecoil(actor,{}); // camera and next shot use the same offset\n  }\n  damage(target, amount, source")
swap("    target.alive = false; target.deaths++;", "    resetAutoAim(target);target.aimRecoil=freshRecoil();\n    target.alive = false; target.deaths++;")
swap("    actor.inventory[type]--;", "    actor.inventory[type]--;\n    if(actor.isPlayer)actor.requireFireRelease=true;")
swap("    const origin = eye(actor), dir = direction(actor.yaw, actor.pitch + .15);\n    this.state.grenades.push({ ...origin, id: `grenade-${++this.eventSerial}`, type, ownerId: actor.id,\n      vx: dir.x * this.config.grenadeSpeed, vy: dir.y * this.config.grenadeSpeed + 1.8, vz: dir.z * this.config.grenadeSpeed,\n      radius: this.config.grenadeRadius, deadline: this.state.time + this.config.grenadeFuse, lastBounce: -Infinity });", "    this.state.grenades.push({ ...grenadeLaunch(actor,this.config),\n      id:`grenade-${++this.eventSerial}`,type,ownerId:actor.id,\n      deadline:this.state.time+this.config.grenadeFuse,lastBounce:-Infinity });")
start=s.index('      grenade.vy -= this.config.gravity * dt;');end=s.index('      if (this.state.time + EPS >= grenade.deadline)',start)
s=s[:start]+"      const bounced=advanceGrenade(grenade,dt,this.world,this.config.gravity);\n      if(bounced&&this.state.time-grenade.lastBounce>.12){\n        this.emit('bounce',null,{...point(grenade),grenade:grenade.type});grenade.lastBounce=this.state.time;\n      }\n"+s[end:]
s=s.replace('./action-rules.mjs?v=hissrum-features-v3','./action-rules.mjs?v=arsenal-v7');p.write_text(s)
p=root/'fps/action-rules.mjs';s=p.read_text();s="import {freshRecoil} from './recoil.mjs';\n"+s
s=s.replace("a.weapon=id;a.lastWeapon=a.inventory.pistol.id;a.armor=60;a.money=g.config.maxMoney;a.loadout=id;", "a.weapon=id;a.lastWeapon=a.inventory.pistol.id;a.armor=60;\n a.money=g.config.liveShop&&a.isPlayer?Math.max(0,Math.min(g.config.maxMoney,a.money??g.config.startMoney)):g.config.maxMoney;\n a.loadout=id;")
s=s.replace("recoil:0,flying:false,", "recoil:0,flying:false,aimRecoil:freshRecoil(),rawAimYaw:p.yaw??0,rawAimPitch:0,autoAim:null,autoAimProgress:0,airPatrol:null,");p.write_text(s)
p=root/'fps/bot-flight.mjs';s=p.read_text()
swap(" const now=game.state.time,world=game.world;", " const now=game.state.time,world=game.world,agile=game.config.agileFlight===true;")
swap(" const state=actor.airPatrol??={mode:'ground',nextAt:2+actor.index*.79+(actor.team==='counterAnalysts'?1.3:0),until:0,goalY:0,landSince:0};", " const state=actor.airPatrol??={mode:'ground',nextAt:(agile?now:0)+(agile?.7:2)+actor.index*(agile?.36:.79)+(actor.team==='counterAnalysts'?.4:0),until:0,goalY:0,landSince:0,nextVantage:0,side:actor.index%2?1:-1};")
swap("state.nextAt=now+3.5;", "state.nextAt=now+(agile?1.5:3.5);")
swap(" const scout=actor.index===3 && !point && now>state.nextAt+4;", " const scout=(actor.index===3||agile&&actor.index===0)&&!point&&now>state.nextAt+(agile?1.5:4);")
swap(" const wantsAltitude=!!point&&(blocked||hasTactic)||scout;", " const wantsAltitude=!!point&&(blocked||hasTactic||agile&&actor.index%2===0)||scout;")
swap(" const mustLand=tactical&&(role==='cover'||actor.hp<42||urgent);", " const mustLand=tactical&&(role==='cover'||actor.hp<(agile?30:42)||urgent);")
swap("&&flyingBots<(tactical?2:4)){", "&&flyingBots<(game.config.maxFlyingBots??(tactical?2:4))){")
swap("const heights=[1.0,1.55,2.2].filter", "const heights=(agile?[1.2,2.4,3.6]:[1.0,1.55,2.2]).filter")
swap("     state.until=now+(tactical?3.8:4.3)+(actor.index%3)*.9;", "     state.baseY=desired;state.nextVantage=now+.5;\n     state.until=now+(agile?6.5:tactical?3.8:4.3)+(actor.index%3)*(agile?1.2:.9);")
swap("   }else state.nextAt=now+3;", "   }else state.nextAt=now+(agile?1.2:3);")
swap(" if(!actor.flying)return input;", """ if(!actor.flying)return input;
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
""")
swap("state.nextAt=now+(tactical?9:7.5)+(actor.index%4)*1.5;", "state.nextAt=now+(agile?2.8:tactical?9:7.5)+(actor.index%4)*(agile?.55:1.5);");p.write_text(s)
