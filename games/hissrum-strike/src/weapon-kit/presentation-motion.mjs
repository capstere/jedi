/** Render-only motion. No RNG, gameplay writes, hitboxes or physics imports. */
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : 0));
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

/** Exact critically damped step for a constant target, independent of frame rate. */
export function spring(state, target, dt, frequency = 22) {
  dt = clamp(dt, 0, .1);
  if (!dt) return state.x;
  const displacement = state.x - target, c = state.v + frequency * displacement, decay = Math.exp(-frequency * dt);
  state.x = target + (displacement + c * dt) * decay;
  state.v = (state.v - frequency * c * dt) * decay;
  return state.x;
}
const axis = () => ({ x: 0, v: 0 });
export function createViewMotion() {
  return { actor: null, time: null, shotAt: -Infinity, x: 0, z: 0, yaw: 0, pitch: 0, phase: 0,
    swayX: axis(), swayY: axis(), kick: axis(), pitchKick: axis(), rollKick: axis() };
}
export const WEAPON_PRESENTATION = Object.freeze({
  p9:      Object.freeze({ mass: 1, kick: .95, pitch: 1.55, settle: 25, roll: .22 }),
  p12:     Object.freeze({ mass: 1.18, kick: 1.25, pitch: 1.90, settle: 23, roll: .26 }),
  ar47:    Object.freeze({ mass: 1.45, kick: 1.02, pitch: 1.05, settle: 26, roll: .15 }),
  cr4:     Object.freeze({ mass: 1.35, kick: .84, pitch: .87, settle: 28, roll: .12 }),
  smg:     Object.freeze({ mass: 1.12, kick: .68, pitch: .78, settle: 29, roll: .11 }),
  shotgun: Object.freeze({ mass: 1.65, kick: 1.80, pitch: 2.25, settle: 20, roll: .23 }),
  sniper:  Object.freeze({ mass: 1.80, kick: 1.55, pitch: 1.75, settle: 21, roll: .15 }),
});
const fallback = WEAPON_PRESENTATION.cr4;

/** Actor is read-only. State belongs to a cached cosmetic weapon, not Game. */
export function viewMotion(state, actor, time, { weapon = actor.weapon, shotAt = -Infinity, reducedMotion = false } = {}) {
  const x = Number.isFinite(actor.x) ? actor.x : 0, z = Number.isFinite(actor.z) ? actor.z : 0;
  const yaw = Number.isFinite(actor.yaw) ? actor.yaw : 0, pitch = Number.isFinite(actor.pitch) ? actor.pitch : 0;
  const same = state.actor === actor.id && state.time !== null && time >= state.time && time - state.time <= .25 && Math.hypot(x - state.x, z - state.z) < 2;
  if (!same) {
    Object.assign(state, createViewMotion(), { actor: actor.id, time, x, z, yaw, pitch, shotAt });
    return { position: [0, 0, 0], rotation: [0, 0, 0] };
  }
  const dt = clamp(time - state.time, 0, .05), profile = WEAPON_PRESENTATION[weapon] || fallback;
  if (dt > 0) {
    const distance = Math.hypot(x - state.x, z - state.z);
    state.phase += distance * 5.2;
    const turn = clamp(wrapAngle(yaw - state.yaw) / dt, -7, 7), tilt = clamp((pitch - state.pitch) / dt, -7, 7);
    spring(state.swayX, reducedMotion ? 0 : -turn * .008 * profile.mass, dt, 18);
    spring(state.swayY, reducedMotion ? 0 : tilt * .006 * profile.mass, dt, 20);
    if (Number.isFinite(shotAt) && shotAt !== state.shotAt && time >= shotAt && time - shotAt < .15) {
      const scale = reducedMotion ? .4 : 1;
      state.kick.v += profile.kick * scale;
      state.pitchKick.v -= profile.pitch * scale;
      state.rollKick.v += Math.sin(shotAt * 41.3) * profile.roll * scale;
      state.shotAt = shotAt;
    }
    spring(state.kick, 0, dt, profile.settle);
    spring(state.pitchKick, 0, dt, profile.settle * .90);
    spring(state.rollKick, 0, dt, profile.settle * .85);
  }
  const speed = clamp((Number(actor.moving) || 0) / 4.2);
  const walk = reducedMotion ? 0 : speed;
  const idle = reducedMotion ? 0 : Math.sin(time * 1.55) * .00065;
  const result = {
    position: [clamp(state.swayX.x, -.035, .035) + Math.sin(state.phase) * .0028 * walk,
      clamp(state.swayY.x, -.025, .025) + Math.cos(state.phase * 2) * .0018 * walk + idle,
      clamp(state.kick.x, 0, .055)],
    rotation: [clamp(state.pitchKick.x, -.13, .03), clamp(-state.swayX.x * 1.1, -.05, .05),
      clamp(state.rollKick.x + state.swayX.x * .55, -.035, .035)]
  };
  Object.assign(state, { time, x, z, yaw, pitch });
  return result;
}

/** A stance/swing curve. The stance travels linearly backwards, avoiding a sine-slide. */
export function strideSample(phase, speed = 0, crouch = 0) {
  const u = ((phase % 1) + 1) % 1, stance = .60, travel = clamp(speed / 3.5), c = clamp(crouch);
  const span = (.44 + travel * .14) * (1 - c * .5) * travel;
  if (u < stance) return { along: span * (.5 - u / stance), lift: 0, contact: true };
  const swing = (u - stance) / (1 - stance);
  return { along: span * (-.5 + smooth(swing)), lift: Math.sin(Math.PI * swing) * .070 * travel * (1 - c * .4), contact: false };
}

/** Two-bone cosmetic leg. Clamp unreachable targets; never move the actor capsule. */
export function solveLeg(footZ, drop, upper = .39, lower = .388) {
  const distance = clamp(Math.hypot(footZ, drop), .035, upper + lower - .0001);
  const direction = Math.atan2(-footZ, Math.max(.02, drop));
  const hip = direction - Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1));
  const knee = Math.PI - Math.acos(clamp((upper * upper + lower * lower - distance * distance) / (2 * upper * lower), -1, 1));
  return { hip, knee, distance };
}
