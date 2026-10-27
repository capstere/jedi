/** Riposte-inspired rising recoil, authored for Hissrum Strike.
 * Camera and hitscan share these offsets. Cosmetic gun motion is separate.
 * No aim snapping, game RNG changes or frame-rate-dependent timers.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const RECOIL_PROFILES=Object.freeze({
 p9:{kick:.027,side:.005},p12:{kick:.032,side:.006},
 smg:{kick:.016,side:.004},ar47:{kick:.030,side:.007},cr4:{kick:.024,side:.006},
 shotgun:{kick:.070,side:.012},sniper:{kick:.082,side:.008},bazooka:{kick:.065,side:.008}
});
export function freshRecoil(){return {pitch:0,yaw:0,heat:0,serial:0,last:-Infinity};}
export function recoverRecoil(r,dt,now){
 const elapsed=clamp(Number(dt)||0,0,.25);
 const rest=now-r.last,rate=rest>.14?7.0:1.15;
 r.pitch*=Math.exp(-rate*elapsed);r.yaw*=Math.exp(-rate*1.2*elapsed);
 r.heat=Math.max(0,r.heat-elapsed*(rest>.18?9:1.2));
 if(Math.abs(r.pitch)<1e-6)r.pitch=0;if(Math.abs(r.yaw)<1e-6)r.yaw=0;
 return r;
}
export function kickRecoil(r,id,now){
 const profile=RECOIL_PROFILES[id];if(!profile)return r;
 const continuous=now-r.last<.34;
 r.heat=continuous?Math.min(14,r.heat+1):1;
 const multiplier=1+Math.min(12,r.heat-1)*.11;
 r.pitch=clamp(r.pitch+profile.kick*multiplier,0,.40);
 const lateral=Math.sin(++r.serial*1.73)*profile.side*multiplier;
 r.yaw=clamp(r.yaw+lateral,-.07,.07);r.last=now;return r;
}
export function applyAimRecoil(actor,input){
 const r=actor.aimRecoil??=freshRecoil();
 if(Number.isFinite(input.yaw))actor.rawAimYaw=input.yaw;
 if(Number.isFinite(input.pitch))actor.rawAimPitch=input.pitch;
 actor.rawAimYaw??=actor.yaw||0;actor.rawAimPitch??=actor.pitch||0;
 actor.yaw=actor.rawAimYaw+r.yaw;
 actor.pitch=clamp(actor.rawAimPitch+r.pitch,-1.49,1.49);
}
