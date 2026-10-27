/** Shared VISUAL/AUDIO timing, in normalized reload time. Game still owns ammo,
 * duration and completion. No timers, randomness or actor writes in this file. */
export const KIT_IDS = Object.freeze(['p9','p12','cr4']);
export const kitWeapon = id => KIT_IDS.includes(id);
export const saturate = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export const smooth = x => { x=saturate(x);return x*x*(3-2*x); };
export const envelope = (t,a,b,c,d) => smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));
export const RELOAD_CUES = Object.freeze([
 Object.freeze({at:.12,id:'release'}), Object.freeze({at:.25,id:'out'}),
 Object.freeze({at:.64,id:'in'}), Object.freeze({at:.83,id:'action',emptyOnly:true})
]);
export function reloadPose(progress, {empty=false,rifle=false}={}) {
 const p=saturate(progress),lift=envelope(p,0,.12,.81,1);
 // Keep the original contract at .35: the support glove holds the moving mag.
 const grip=envelope(p,.08,.23,.70,.81),pull=envelope(p,.15,.37,.48,.64);
 const action=empty?envelope(p,.71,.80,.88,.96):0;
 return {progress:p,lift,grip,pull,action,hidden:p>.41&&p<.49,
  magPosition:[-pull*.055,-pull*(rifle?.225:.20),pull*.035],
  magRotation:[-pull*.13,0,-pull*.20],
  rotation:[lift*(rifle?.09:-.07),lift*(rifle?.24:.08),-lift*.29],
  translation:[-lift*.035,lift*.038,-lift*.03]};
}
export function reloadIsEmpty(actor,id){
 const inv=actor?.inventory;
 if(!inv)return false;
 return Object.values(inv).some(v=>v&&typeof v==='object'&&v.id===id&&v.ammo===0);
}
export function reloadPhase(actor,id,time,duration){
 return actor.reloadUntil>time?saturate(1-(actor.reloadUntil-time)/duration):0;
}
