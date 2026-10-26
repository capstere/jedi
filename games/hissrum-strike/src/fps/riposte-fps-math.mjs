/** MIT-licensed adaptation of selected FPS math/bot ideas from
 * Riposte: Frontline 5.6.0, Copyright (c) 2026 BenDBSS.
 * Standalone pure functions. See ../../licenses/riposte-MIT.txt.
 */
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smoothstep=(a,b,x)=>{if(a===b)return x<a?0:1;const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-Math.max(0,k)*Math.max(0,dt)));
export const angleDifference=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
export const finiteOr=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
export const ownKey=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
export function seededRandom(seed=1){let a=seed|0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
export const BOT_TUNING=Object.freeze({
 recruit:Object.freeze({reaction:[.45,.8],aimError:.11,aimSettle:1.7,turnSpeed:3.2,detection:.6,memory:2.5,simultaneousAttackers:1}),
 regular:Object.freeze({reaction:[.28,.5],aimError:.08,aimSettle:1.1,turnSpeed:4.8,detection:.85,memory:4,simultaneousAttackers:2}),
 veteran:Object.freeze({reaction:[.16,.3],aimError:.055,aimSettle:.7,turnSpeed:7,detection:1.1,memory:6,simultaneousAttackers:3})
});
export const WEAPON_MIX=Object.freeze({
 close:Object.freeze({smg:.35,rifle:.30,shotgun:.25,sniper:.10}),
 mid:Object.freeze({rifle:.45,smg:.27,shotgun:.14,sniper:.14}),
 open:Object.freeze({rifle:.40,sniper:.25,smg:.20,shotgun:.15})
});
export function pickWeaponCategory(mapType='mid',{rng=Math.random,allowSniper=true}={}){
 const mix=WEAPON_MIX[mapType]??WEAPON_MIX.mid;
 const options=Object.entries(mix).filter(([k,v])=>v>0&&(allowSniper||k!=='sniper'));
 const sum=options.reduce((s,[,v])=>s+v,0);if(!sum)return 'rifle';
 let roll=clamp(Number(rng()),0,1-Number.EPSILON)*sum;
 for(const [key,p] of options){roll-=p;if(roll<0)return key;}return options.at(-1)[0];
}
export function attackerTokensAllowed(profile,attackingCount){
 const p=typeof profile==='string'?(BOT_TUNING[profile]??BOT_TUNING.regular):profile;
 return Math.max(0,(p.simultaneousAttackers|0)-Math.max(0,attackingCount|0));
}
export function reactionWindow(profile,{rng=Math.random}={}){
 const p=typeof profile==='string'?(BOT_TUNING[profile]??BOT_TUNING.regular):profile;
 return lerp(p.reaction?.[0]??.3,p.reaction?.[1]??.5,clamp(Number(rng()),0,1));
}
