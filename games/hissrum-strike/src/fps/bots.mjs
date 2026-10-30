// Yuka's StateMachine, MemorySystem and steering are executed here, not merely
// bundled. Collision and paths come only from the accepted floor adapter.
import { MemorySystem, SeekBehavior, State, StateMachine, Vector3, Vehicle } from '../../vendor/yuka/yuka.module.js';
import { WEAPONS } from './config.mjs';
import {actionObjective,friendlyLineClear} from './action-rules.mjs?v=combat-comfort-v18';
import {angleDifference} from './riposte-fps-math.mjs';
import { distanceSegment } from './physics.mjs';
import {chooseTactic,latestSquadContact,planTacticalPosition} from './tactical-ai.mjs';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const eye = a => ({ x: a.x, y: a.y + a.height - .12, z: a.z });
const angleDelta = (a, b) => angleDifference(b,a);
const position = a => ({ x: a.x, y: a.y ?? 0, z: a.z });
const aimAt = (a, b) => ({ yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)), pitch: Math.atan2((b.y ?? 1) - (a.y + a.height - .12), distance(a, b)) });

class ObjectiveState extends State { execute(bot) { bot.planObjective(); } }
class CombatState extends State { execute(bot) { bot.planCombat(); } }
class InvestigateState extends State { execute(bot) { bot.planInvestigation(); } }

export class BotController {
  constructor(game, actor) {
    this.game = game; this.actor = actor; this.vehicle = new Vehicle();
    this.profile = game.difficultyProfileFor(actor); this.aimGoal = null;
    this.burstRemaining = 0; this.burstUntil = 0; this.burstTargetId = null; this.nextBurstAt = 0; this.lastShotAt = -Infinity;
    this.vehicle.maxSpeed = game.config.botSpeed; this.vehicle.updateOrientation = false;
    this.seek = new SeekBehavior(); this.vehicle.steering.add(this.seek);
    this.force = new Vector3(); this.memory = new MemorySystem(this.vehicle); this.memory.memorySpan = game.config.botMemory;
    this.machine = new StateMachine(this);
    this.machine.add('objective', new ObjectiveState()).add('combat', new CombatState()).add('investigate', new InvestigateState()).changeTo('objective');
    this.mode = 'objective'; this.nextDecision = 0; this.nextPath = 0; this.path = []; this.goal = null;
    this.target = null; this.records = []; this.heardSerial = 0; this.nextGrenade = game.state.time + 5;
    this.stuckTime = 0; this.replans = 0; this.lastPosition = position(actor); this.lastProgress = game.state.time; this.lastReplan = game.state.time;
    this.command = {}; this.distanceTravelled = 0;
    this.routePlan = null; this.routeStarted = false; this.lastContactReport = -Infinity;
    this.tactical = null; this.nextTacticalPlan = 0; this.sharedContact = null;
    actor.aiRole = actor.team === 'analysts' ? ['site','south guard','north guard','hostage guard','PQC support'][actor.index] : ['bomb','rescue','rescue flank','support','flank'][actor.index];
    actor.aiLane = null;
  }
  shop() {
    const a = this.actor, game = this.game;
    if (!a.inventory.primary) {
      const teamRifle = a.team === 'analysts' ? 'ar47' : 'cr4';
      const primary = a.money >= WEAPONS[teamRifle].cost + 300 ? teamRifle : a.money >= 1800 && a.index === 2 ? 'shotgun' : a.money >= 1250 ? 'smg' : null;
      if (primary) game.buy(primary, a);
    }
    if (a.money >= 1000 && !a.armor) game.buy('armor', a);
    const grenade = a.index % 3 === 0 ? 'smoke' : a.index % 3 === 1 ? 'flash' : 'he';
    if (a.money >= 550 && !a.inventory[grenade]) game.buy(grenade, a);
  }
  perceive() {
    const { game, actor } = this, now = game.state.time, c = game.config;
    const enemies = game.actors.filter(a => a.team !== actor.team && a.alive);
    for (const enemy of enemies) {
      if (!this.memory.hasRecord(enemy)) this.memory.createRecord(enemy);
      const record = this.memory.getRecord(enemy), d = distance(actor, enemy), bearing = Math.atan2(-(enemy.x - actor.x), -(enemy.z - actor.z));
      const visible = actor.flash < .3 && d <= c.botVision && (d < 1.3 || Math.abs(angleDelta(bearing, actor.yaw)) < c.botFov / 2) && game.canSee(eye(actor), eye(enemy));
      if (visible) {
        if (!record.visible) {
          const gap = now - (record.lastSeenAt ?? -Infinity);
          if (!Number.isFinite(record.reactionAt) || gap > this.profile.reacquireGrace) {
            record.detectedAt = now;
            record.reactionAt = now + this.profile.reactionMin + game.random() * (this.profile.reactionMax - this.profile.reactionMin);
            record.focusTime = 0;
            game.emit('detected', actor, { targetId: enemy.id, detectedAt: now, reactionAt: record.reactionAt, distance: d });
          } else record.focusTime *= Math.exp(-gap * 2);
          record.timeBecameVisible = now;
        } else record.focusTime = Math.min(this.profile.settleTime, (record.focusTime ?? 0) + now - record.lastSeenAt);
        record.lastSeenAt = now;
        if (now - this.lastContactReport > 4) {
          // Team reports only positions actually seen; stale contacts decay. This
          // shared memory never reads enemy positions while choosing a route.
          const contacts = game.tacticalContacts ??= [];
          contacts.push({ team: actor.team, x: enemy.x, z: enemy.z, at: now });
          if (contacts.length > 48) contacts.shift();
          this.lastContactReport = now;
        }
        record.timeLastSensed = now; record.lastSensedPosition.set(enemy.x, enemy.y + enemy.height * .6, enemy.z);
      }
      if (record.visible && !visible && this.burstTargetId === enemy.id) { this.burstRemaining = 0; this.burstUntil = 0; this.nextBurstAt = Math.max(this.nextBurstAt, now + .15); }
      record.visible = visible;
    }
    // Logical sound exists even when Web Audio is muted. Walls shorten hearing;
    // remembered positions are snapshots, never live coordinates through a wall.
    for (const event of game.soundEvents) {
      const sourceId = event.actorId ?? event.ownerId;
      if (event.serial <= this.heardSerial || !sourceId || event.team === actor.team) continue;
      const enemy = enemies.find(a => a.id === sourceId); if (!enemy) continue;
      const clear = game.world.segmentClear(eye(actor), { x: event.x, y: event.y + 1, z: event.z }, { vision: false });
      let radius = event.type === 'shot' ? 38 : event.type === 'step' ? (event.mode === 'run' ? 12 : event.mode === 'sneak' ? 2.5 : 2) : event.type === 'he' ? 45 : 7;
      if (!clear) radius *= .28;
      if (distance(actor, event) <= radius) {
        const record = this.memory.getRecord(enemy);
        record.timeLastSensed = now;
        if (!record.visible) record.lastSensedPosition.set(event.x, event.y + 1, event.z);
      }
    }
    this.heardSerial = game.eventSerial;
    this.memory.getValidMemoryRecords(now, this.records);
    const visible = this.records.filter(r => r.entity.alive && r.visible).sort((a, b) => distance(actor, a.lastSensedPosition) - distance(actor, b.lastSensedPosition));
    this.target = visible[0] ?? null;
    const remembered = this.records.filter(r => r.entity.alive).sort((a, b) => b.timeLastSensed - a.timeLastSensed);
    this.investigation = remembered[0] ?? null;
    this.sharedContact = game.config.tacticalAI ? latestSquadContact(game,actor) : null;
  }
  update(dt) {
    const { game, actor } = this, now = game.state.time;
    if (now >= this.nextDecision) {
      this.nextDecision = now + game.config.botDecisionInterval;
      this.perceive();
      // Defusing and planting keep priority once in progress; fighting cannot
      // repeatedly reset the last second of a valid objective interaction.
      const readyToPlant = game.bomb.carrierId === actor.id && game.interaction(actor)?.type === 'plant';
      const nextMode = actor.action || readyToPlant ? 'objective' : this.target ? 'combat'
        : (this.investigation || this.sharedContact) && !this.urgentObjective() ? 'investigate' : 'objective';
      if (nextMode !== this.mode) { this.mode = nextMode; this.machine.changeTo(nextMode); }
      this.command = {}; this.aimGoal = null; this.machine.update();
    }
    const input = { ...this.command };
    const item = game.item(actor);
    if (item && typeof item === 'object' && item.ammo === 0) {
      this.burstRemaining = 0;
      if (item.reserve > 0) game.reload(actor); else if (actor.inventory.pistol?.ammo || actor.inventory.pistol?.reserve) game.select('pistol', actor); else game.select('knife', actor);
    }
    if (!input.interact && this.goal) this.follow(dt, input);
    else { this.path = []; this.vehicle.velocity.set(0, 0, 0); }
    if (this.aimGoal && this.target?.visible) {
      const turn = this.profile.turnSpeed * dt;
      input.yaw = actor.yaw + Math.max(-turn, Math.min(turn, angleDelta(this.aimGoal.yaw, actor.yaw)));
      input.pitch = actor.pitch + Math.max(-turn, Math.min(turn, this.aimGoal.pitch - actor.pitch));
    }
    if(input.fire&&!friendlyLineClear(this,input))input.fire=false;
    if (input.fire && !game.config.botFire) input.fire = false;
    // A cached visual record must not allow a shot after the target crosses a
    // wall/smoke between perception ticks. Recheck physical sight each shot.
    if (input.fire && this.target && !game.canSee(eye(actor), eye(this.target.entity))) input.fire = false;
    if (input.fire && this.target?.visible && game.config.tacticalAI) {
      // Stop spray-and-pray while sprinting across the room. Let the actual
      // weapon/reaction/cooldown systems own each subsequent shot.
      const target=this.target.lastSensedPosition;
      const aimed=aimAt(actor,target),shotYaw=Number.isFinite(input.yaw)?input.yaw:actor.yaw,
        shotPitch=Number.isFinite(input.pitch)?input.pitch:actor.pitch;
      const tolerance=this.profile.id==='casual'?.24:this.profile.id==='hard'?.14:.19;
      if (Math.abs(angleDelta(aimed.yaw,shotYaw))>tolerance
        ||Math.abs(shotPitch-aimed.pitch)>tolerance*.9
        ||(actor.moving>2.15&&distance(actor,target)>4))input.fire=false;
    }
    if (input.fire && !this.canFireBurst()) input.fire = false;
    const travelled = distance(actor, this.lastPosition);
    this.distanceTravelled += travelled; this.lastPosition = position(actor);
    if (travelled > .006) this.lastProgress = now;
    if (this.goal && now - this.lastProgress > 1.2 && now - this.lastReplan > 1.2) {
      this.nextPath = 0; this.path = []; this.replans++; this.lastReplan = now;
      // Retry from the current physical capsule. Never teleport or disable
      // collision when a path is blocked by another agent or furniture.
    }
    return input;
  }
  canFireBurst() {
    const { game, actor, target, profile } = this, now = game.state.time;
    if (!target?.visible || now + 1e-8 < target.reactionAt || actor.reloadUntil || actor.flash >= .6) return false;
    if (this.burstTargetId !== target.entity.id) { this.burstRemaining = 0; this.burstTargetId = target.entity.id; }
    if (this.burstRemaining > 0) return true;
    if (now < this.nextBurstAt) return false;
    // This only budgets independently perceived firing opportunities. It never
    // communicates the human's coordinates or grants sight to another bot.
    if (target.entity.isPlayer) {
      const others = game.actors.filter(a => a !== actor && a.alive && a.team === actor.team && a.bot?.target?.entity === target.entity && a.bot.burstRemaining > 0 && a.bot.burstUntil > now);
      if (others.length >= profile.humanAttackers) return false;
    }
    this.burstRemaining = profile.burstMin + Math.floor(game.random() * (profile.burstMax - profile.burstMin + 1));
    this.burstUntil = now + this.burstRemaining * (WEAPONS[actor.weapon].interval || .3) + .35;
    return true;
  }
  onShot() {
    this.lastShotAt = this.game.state.time;
    if (this.burstRemaining > 0) this.burstRemaining--;
    if (!this.burstRemaining) {
      this.burstUntil = 0;
      this.nextBurstAt = this.game.state.time + this.profile.pauseMin + this.game.random() * (this.profile.pauseMax - this.profile.pauseMin);
    }
  }
  /** Stable tactical position selection, at most one expensive floor search
   * every few simulation seconds. The selected point remains collision-validated
   * even when another bot temporarily obstructs the route.
   */
  tacticalPosition(contact,role){
    const {game,actor}=this,now=game.state.time;
    if(!game.config.tacticalAI || !contact || role==='objective')return false;
    const old=this.tactical;
    const targetMoved=old?.seen&&distance(old.seen,contact)>3.5;
    if(old && old.kind===role && !targetMoved && old.until>now){
      if(distance(actor,old.point)>.85)this.setGoal(old.point);
      else this.setGoal(null); // Hold angle rather than pacing in place.
      actor.aiState={cover:'tar skydd',flank:'flankerar',support:'täcker lagkamrat',
        hold:'håller vinkel',investigate:'spanar från sidan'}[role];
      return true;
    }
    if(now<this.nextTacticalPlan)return false;
    this.nextTacticalPlan=now+1.1;
    const result=planTacticalPosition(game,actor,contact,role);
    if(!result)return false;
    this.tactical={
      kind:role,point:{x:result.x,z:result.z},
      seen:{x:contact.x,z:contact.z},until:now+(role==='cover'?2.1:3.4)+actor.index*.13,
      score:result.score
    };
    if(distance(actor,result)>1.0)this.setGoal(result);
    else this.setGoal(null);
    actor.aiState={cover:'tar skydd',flank:'flankerar',support:'täcker lagkamrat',
      hold:'håller vinkel',investigate:'spanar från sidan'}[role];
    return true;
  }
  urgentObjective() {
    const { game, actor } = this;
    return game.bomb.status === 'planted' || game.bomb.carrierId === actor.id || game.hostages.some(h => h.escortId === actor.id);
  }
  setGoal(goal) {
    if (!goal) { this.goal = null; this.path = []; return; }
    if (!this.goal || distance(this.goal, goal) > .5) this.nextPath = 0;
    this.goal = { x: goal.x, z: goal.z };
  }
  planObjective() {
    if(actionObjective(this))return;
    const { game, actor } = this, b = game.bomb, anchors = game.world.anchors;
    actor.aiState = 'uppdrag';
    if (actor.team === 'analysts') {
      if (b.status === 'planted') {
        const defenders = game.actors.filter(a => a.alive && a.team === 'analysts').sort((a, c) => distance(a, b) - distance(c, b));
        // Player can always take over; nearest living bot attempts defuse.
        const owner = defenders.find(a => a.bot);
        if (owner === actor) {
          if (game.interaction(actor)?.type === 'defuse') { this.command.interact = true; this.setGoal(null); actor.aiState = 'desarmerar'; }
          else this.setGoal(b);
          return;
        }
        this.setGoal(this.guardPoint(b, actor.index)); return;
      }
      const positions = game.world.tactical?.guardPoints;
      // Keep three bot teammates around the two site entrances and PQC; the
      // human is no longer left alone while three defenders all chase I12.
      const guard = positions ? [anchors.bomb, positions.south, positions.north, anchors.hostages[0], positions.pqc][actor.index] : actor.index < 2 ? anchors.bomb : anchors.hostages[(actor.index - 2) % anchors.hostages.length];
      this.setGoal(this.guardPoint(guard, actor.index));
      if (distance(actor, this.goal) < .35) {
        this.setGoal(null); this.command.yaw = actor.yaw + .55;
      }
      return;
    }
    if (b.status === 'dropped') {
      const owners = game.actors.filter(a => a.alive && a.team === actor.team && a.bot).sort((a, c) => distance(a, b) - distance(c, b));
      if (owners[0] === actor) {
        if (game.interaction(actor)?.type === 'pickupBomb') { this.command.interact = !actor.interactHeld; this.setGoal(null); }
        else this.setGoal(b);
        return;
      }
    }
    if (b.carrierId === actor.id) {
      if (game.interaction(actor)?.type === 'plant') { this.command.interact = true; this.setGoal(null); actor.aiState = 'planterar'; }
      else this.setGoal(anchors.bomb);
      return;
    }
    const escorted = game.hostages.filter(h => h.alive!==false && !h.rescued && h.escortId === actor.id);
    if (escorted.length) {
      this.setGoal(anchors.rescue); actor.aiState = 'eskorterar';
      // Keep pace with the physical follower, including around corners.
      if (escorted.some(h => distance(h, actor) > 3)) this.setGoal(null);
      return;
    }
    const available = game.hostages.filter(h => h.alive!==false && !h.rescued && !h.escortId);
    if (available.length) {
      const eligible = game.actors.filter(a => a.alive && a.team === actor.team && a.bot && b.carrierId !== a.id && !game.hostages.some(h => h.escortId === a.id)).sort((a, c) => a.index - c.index);
      const rank = eligible.indexOf(actor);
      if (rank < available.length) {
        const hostage = available[rank];
        if (distance(actor, hostage) < game.config.interactDistance - .15 && game.world.segmentClear(eye(actor), { ...position(hostage), y: .8 }, { vision: false })) {
          this.command.interact = !actor.interactHeld; this.command.interactTarget = hostage.id; this.setGoal(null);
        } else this.setGoal(hostage);
        return;
      }
    }
    const escort = game.actors.find(a => a.alive && game.hostages.some(h => h.escortId === a.id));
    const cover = b.status === 'planted' ? b : escort ?? anchors.bomb;
    this.setGoal(this.guardPoint(cover, actor.index));
    if (distance(actor, this.goal) < .4) { this.setGoal(null); this.command.yaw = actor.yaw + .55; }
  }
  guardPoint(center, index) {
    for (let i = 0; i < 8; i++) {
      const angle = index * 1.3 + i * Math.PI / 4;
      const p = { x: center.x + Math.cos(angle) * 1.15, z: center.z + Math.sin(angle) * 1.15 };
      if (this.game.world.canOccupy(p.x, p.z, this.actor.radius) && this.game.world.segmentClear({ ...position(center), y: .8 }, { ...p, y: .8 }, { vision: false })) return p;
    }
    return center;
  }
  planInvestigation() {
    const lastKnown=this.investigation?.lastSensedPosition ?? this.sharedContact;
    if(!lastKnown){this.setGoal(null);return;}
    this.actor.aiState = this.sharedContact&&!this.investigation?'undersöker lagets observation':'undersöker ljud';
    if(!this.tacticalPosition(lastKnown,'investigate')){
      this.setGoal(lastKnown);
      if (this.goal&&distance(this.actor,this.goal)<.6) {
        this.setGoal(null);this.command.yaw=this.actor.yaw+.55;
      }
    }
    // Suspicion never grants a shot. Combat still requires a new actual sight.
    this.command.fire=false;
  }
  planCombat() {
    const { game, actor, target } = this, now = game.state.time;
    actor.aiState = 'strid';
    if (!target?.visible) return;
    const point = { x: target.lastSensedPosition.x, y: target.lastSensedPosition.y, z: target.lastSensedPosition.z };
    const profile = this.profile, focus = Math.min(1, (target.focusTime ?? 0) / profile.settleTime);
    const hurt = Math.max(0, 1 - (now - actor.hurtTime) / profile.hurtRecovery);
    const aim = aimAt(actor, point), range = distance(actor, point);
    const error = (profile.initialAimError + (profile.steadyAimError - profile.initialAimError) * focus) *
      (1 + Math.max(0, range - 6) / profile.distanceErrorScale) * (1 + actor.moving * profile.movingAimPenalty + hurt * profile.hurtAimPenalty + actor.flash * 6);
    this.aimError = error;
    this.aimGoal = { yaw: aim.yaw + (game.random() - .5) * error, pitch: aim.pitch + (game.random() - .5) * error };
    this.command.fire = now + 1e-8 >= target.reactionAt && actor.flash < .6;
    const equipped = WEAPONS[actor.weapon], d = distance(actor, point);
    if (!game.world.segmentClear(eye(actor), point, { vision: false })) {
      // Intact clear glazing permits perception but still stops bullets. Follow
      // the floor navigation through its door rather than firing forever at it.
      this.command.fire = false; this.setGoal(point); return;
    }
    if (equipped.slot === 'bomb') game.select(actor.inventory.primary ? 'primary' : 'pistol', actor);
    if (equipped.slot === 'grenade') { this.aimGoal.pitch = .08; this.setGoal(null); return; }
    if (equipped.slot === 'knife' && d > 1.3 || d > 22) this.setGoal(point);
    else this.setGoal(null);
    // The objective carrier/flanker can cross a distant firing angle toward its
    // assigned entrance instead of every bot stopping at the first visible
    // doorway. Ordinary collision, movement inaccuracy and damage still apply.
    const flankGoal = this.routePlan?.gates[0] ?? (game.bomb.carrierId === actor.id && distance(actor,game.world.anchors.bomb)<4 ? game.world.anchors.bomb : null);
    if (actor.team === 'counterAnalysts' && [0,4].includes(actor.index) && flankGoal && actor.hp > 35 && d > 5) this.setGoal(flankGoal);
    if(game.config.tacticalAI && !this.urgentObjective()){
      const role=chooseTactic(actor,now);
      this.tacticalPosition(point,role);
      if(role==='cover' && this.tactical?.kind==='cover'){
        // Don't keep unloading into open air while running for cover.
        if(distance(actor,this.tactical.point)>.9)this.command.fire=false;
        if(game.item(actor)?.ammo < (equipped.magazine||30)*.36
          &&game.item(actor)?.reserve>0 && now-actor.lastStep>.22)
          game.reload(actor);
      }
    }
    if (now > this.nextGrenade && d > 4 && d < 14 && now >= target.reactionAt && target.focusTime > .7) {
      const grenade = actor.inventory.he ? 'he' : actor.inventory.flash ? 'flash' : actor.inventory.smoke ? 'smoke' : null;
      if (grenade) {
        // Grenade fire still uses normal equipped-item cooldown and inventory.
        game.select(grenade, actor); this.aimGoal.pitch = .08; this.nextGrenade = now + 12;
      }
    }
  }
  chooseRoute() {
    const { game, actor } = this, tactical = game.world.tactical;
    if (!tactical || this.routeStarted || this.mode !== 'objective' || actor.team !== 'counterAnalysts' || actor.x < -10 || !this.goal || this.goal.x > -15 || game.bomb.status === 'planted' || game.hostages.some(h => h.escortId === actor.id)) return;
    const room = game.world.roomAt(this.goal.x, this.goal.z), lab = ['I01','I02'].includes(room?.id);
    const preferred = actor.index === 4 || actor.index === 2 || actor.index === 0 && (game.state.round + game.seed) % 2 === 0 ? 'flank' : 'direct';
    const contacts = (game.tacticalContacts ?? []).filter(c => c.team === actor.team && game.state.time >= c.at && game.state.time - c.at < 150);
    const candidates = tactical.lanes.map(lane => {
      const plan = tactical.candidate(lane.id, actor, this.goal, { lab });
      if (!plan) return null;
      const assigned = game.actors.filter(a => a !== actor && a.alive && a.team === actor.team && a.bot?.routePlan?.laneId === lane.id).length;
      const congestion = game.actors.filter(a => a !== actor && a.alive && a.team === actor.team && distance(a, plan.gates[0]) < 4).length;
      const risk = contacts.reduce((sum,c) => sum + (plan.path.some((p,i) => distanceSegment(c.x,c.z,[i?plan.path[i-1].x:actor.x,i?plan.path[i-1].z:actor.z],[p.x,p.z]) < 3) ? 1 - (game.state.time-c.at)/150 : 0),0);
      return { ...plan, score: plan.length * .035 + assigned * 2.5 + congestion + Math.min(8,risk*1.5) + (lane.id === preferred ? -6 : 0) + game.random() * .4 };
    }).filter(Boolean).sort((a,b)=>a.score-b.score);
    if (!candidates.length) return;
    const chosen = candidates[0]; this.routeStarted = true;
    this.routePlan = { laneId: chosen.laneId, gates: chosen.gates.map(p=>({...p})), lab };
    actor.aiLane = chosen.laneId;
    game.emit('route', actor, { lane: chosen.laneId, role: actor.aiRole, plannedLength: chosen.length });
    this.nextPath = 0;
  }
  follow(dt, input) {
    const { game, actor } = this;
    this.chooseRoute();
    // Gates survive short combat interruptions, but never pull an escort back
    // toward the lab or prevent an urgent planted-bomb objective.
    const outbound = this.mode === 'objective' && this.goal?.x < -15 && game.bomb.status !== 'planted' && !game.hostages.some(h => h.escortId === actor.id);
    if (outbound && this.routePlan) {
      while (this.routePlan.gates.length && distance(actor,this.routePlan.gates[0]) < .22) { this.routePlan.gates.shift(); this.nextPath = 0; }
    }
    const destination = outbound && this.routePlan?.gates.length ? this.routePlan.gates[0] : this.goal;
    if (this.routePlan && (game.bomb.status === 'planted' || game.hostages.some(h => h.escortId === actor.id) || this.mode === 'objective' && this.goal?.x > -15)) this.routePlan.gates = [];
    if (game.state.time >= this.nextPath) {
      this.path = game.world.findPath(actor, destination); this.nextPath = game.state.time + 1.1;
    }
    while (this.path.length && distance(actor, this.path[0]) < .055) this.path.shift();
    const waypoint = this.path[0]; if (!waypoint) return;
    const d = distance(actor, waypoint); if (!d) return;
    this.vehicle.position.set(actor.x, 0, actor.z); this.vehicle.velocity.set(0, 0, 0);
    this.seek.target.set(waypoint.x, 0, waypoint.z);
    this.vehicle.steering.calculate(dt, this.force);
    const length = Math.hypot(this.force.x, this.force.z), step = Math.min(d, game.config.botSpeed * dt);
    if (length) input.moveWorld = { x: this.force.x / length * step, z: this.force.z / length * step };
    if (!this.target) { input.yaw = Math.atan2(-(waypoint.x - actor.x), -(waypoint.z - actor.z)); input.pitch = 0; }
  }
}
