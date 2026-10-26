// Gameplay defaults from docs/FPS_SPEC.md. Every timer uses simulation seconds.
export const TEAMS = Object.freeze({ analysts: 'Analysts', counterAnalysts: 'Counter Analysts' });
export const DEFAULT_DIFFICULTY = 'casual';
// Only enemy behaviour and enemy damage to the human differ. Health, player
// weapon damage, economy, geography and every objective timer remain shared.
export const DIFFICULTIES = Object.freeze({
  casual: Object.freeze({ id: 'casual', name: 'Casual', description: 'Rekommenderat. Långsammare reaktion, korta salvor och 55 % skada från fiendebotar mot dig.',
    reactionMin: .9, reactionMax: 1.2, turnSpeed: 2.5, initialAimError: .17, steadyAimError: .035, settleTime: 2,
    distanceErrorScale: 18, movingAimPenalty: .32, hurtAimPenalty: 2.4, hurtRecovery: 1.1,
    burstMin: 2, burstMax: 3, pauseMin: .75, pauseMax: 1.15, reacquireGrace: .65, humanAttackers: 2, humanDamage: .55 }),
  normal: Object.freeze({ id: 'normal', name: 'Normal', description: 'Snabbare reaktion och tätare salvor. Normal skada mot dig.',
    reactionMin: .48, reactionMax: .7, turnSpeed: 4.5, initialAimError: .10, steadyAimError: .023, settleTime: 1.15,
    distanceErrorScale: 28, movingAimPenalty: .22, hurtAimPenalty: 1.5, hurtRecovery: .8,
    burstMin: 3, burstMax: 5, pauseMin: .35, pauseMax: .6, reacquireGrace: .75, humanAttackers: 3, humanDamage: 1 }),
  hard: Object.freeze({ id: 'hard', name: 'Hard', description: 'Snabb reaktion, bättre sikte och längre salvor. Normal skada; samma siktregler.',
    reactionMin: .23, reactionMax: .38, turnSpeed: 7.5, initialAimError: .065, steadyAimError: .015, settleTime: .65,
    distanceErrorScale: 40, movingAimPenalty: .14, hurtAimPenalty: .9, hurtRecovery: .6,
    burstMin: 4, burstMax: 7, pauseMin: .18, pauseMax: .35, reacquireGrace: .85, humanAttackers: 5, humanDamage: 1 }),
});
export const TEAMMATE_DIFFICULTY = Object.freeze({ ...DIFFICULTIES.normal, id: 'teammate', name: 'Lagkamrat',
  reactionMin: .32, reactionMax: .32, turnSpeed: 6, initialAimError: .06, steadyAimError: .018, settleTime: .6,
  burstMin: 4, burstMax: 6, pauseMin: .18, pauseMax: .35, humanDamage: 1 });
export const CONFIG = Object.freeze({
  difficulty: DEFAULT_DIFFICULTY, mode: 'classic', friendlyFire: false, hostageDamage: false, wanderers: true, respawnDelay: 3, spawnProtection: 1.8,
  fixedStep: 1 / 60, maxCatchUp: .25, buyTime: 15, roundTime: 120, bombTime: 40,
  plantTime: 3, defuseTime: 5, resultTime: 5, matchWins: 5,
  health: 100, startMoney: 800, winMoney: 3250, lossMoney: 1400,
  lossIncrement: 500, maxLossMoney: 3400, killMoney: 300, maxMoney: 16000,
  radius: .20, standingHeight: 1.70, crouchingHeight: 1.08,
  runSpeed: 4.2, sneakSpeed: 1.65, crouchSpeed: 1.35, botSpeed: 3.15,
  flySpeed: 5.8,
  hostageSpeed: 2.9, gravity: 18, jumpSpeed: 5.4,
  interactDistance: 1.65, buyRadius: 5, smokeDuration: 16, smokeRadius: 3.4,
  grenadeFuse: 1.8, grenadeSpeed: 9, grenadeRadius: .10,
  flashDuration: 3.5, flashRadius: 14, heRadius: 6,
  botDecisionInterval: .18, botVision: 32, botFov: 2.55,
  botMemory: 5, botFire: true,
});

const pistol = { slot: 'pistol', cost: 0, range: 65, pellets: 1, spread: .010, movingSpread: .047, recoil: .018, reload: 1.55, automatic: false };
const primary = { slot: 'primary', range: 85, pellets: 1, spread: .006, movingSpread: .036, recoil: .020, automatic: true };
export const WEAPONS = Object.freeze({
  p9: { ...pistol, id: 'p9', name: 'P9 Analyst', team: 'analysts', magazine: 20, reserve: 80, damage: 23, interval: .23 },
  p12: { ...pistol, id: 'p12', name: 'P12 Counter', team: 'counterAnalysts', magazine: 12, reserve: 72, damage: 29, interval: .29 },
  ar47: { ...primary, id: 'ar47', name: 'AR-47', team: 'analysts', cost: 2700, magazine: 30, reserve: 90, damage: 34, interval: .105, reload: 2.3 },
  cr4: { ...primary, id: 'cr4', name: 'CR-4', team: 'counterAnalysts', cost: 3100, magazine: 30, reserve: 90, damage: 29, interval: .095, reload: 2.1 },
  smg: { ...primary, id: 'smg', name: 'Vector C', cost: 1250, magazine: 30, reserve: 120, damage: 18, interval: .075, reload: 1.8, movingSpread: .027 },
  shotgun: { ...primary, id: 'shotgun', name: 'Pump 8', cost: 1800, magazine: 8, reserve: 32, damage: 13, pellets: 8, interval: .85, reload: 2.6, range: 30, spread: .055, movingSpread: .075, automatic: false },
  sniper: { ...primary, id: 'sniper', name: 'Scope 5', cost: 4750, magazine: 5, reserve: 25, damage: 105, interval: 1.25, reload: 2.9, range: 130, spread: .001, movingSpread: .095, automatic: false },
  bazooka: { ...primary, id: 'bazooka', name: 'Bazooka', cost: 3600, magazine: 1, reserve: 5, damage: 150, interval: 1.1, reload: 2.8, range: 88, spread: 0, movingSpread: 0, automatic: false, recoil: .06, projectile: true },
  knife: { id: 'knife', name: 'Kniv', slot: 'knife', cost: 0, damage: 45, range: 1.65, interval: .6, pellets: 1, spread: 0, movingSpread: 0, recoil: .035 },
  smoke: { id: 'smoke', name: 'Smoke Cartridge', slot: 'grenade', cost: 300, limit: 1, interval: .6 },
  flash: { id: 'flash', name: 'Flash Cartridge', slot: 'grenade', cost: 200, limit: 2, interval: .6 },
  he: { id: 'he', name: 'HE Cartridge', slot: 'grenade', cost: 300, limit: 1, interval: .6 },
  bomb: { id: 'bomb', name: 'Uppdragsbomb', slot: 'bomb', cost: 0 },
  armor: { id: 'armor', name: 'Kroppsrustning', slot: 'armor', cost: 650 },
});

export const PRIORITY = Object.freeze({ detonation: 0, defuse: 1, rescue: 2, elimination: 3, draw: 3, timeout: 4 });
export function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
