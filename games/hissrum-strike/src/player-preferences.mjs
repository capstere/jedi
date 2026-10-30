/** Small, versioned local preferences. Invalid/unavailable storage is harmless. */
export const PREFERENCE_KEY='hissrum.comfort.v1';
export const DEFAULT_PREFERENCES=Object.freeze({sensitivity:1,fov:0,quality:'balanced',motion:'system'});
export function sanitizePreferences(value={}){
 if(!value||typeof value!=='object')value={};
 const number=(key,min,max,fallback)=>Number.isFinite(Number(value[key]))&&value[key]!==null&&value[key]!==''?
  Math.max(min,Math.min(max,Number(value[key]))):fallback;
 return {sensitivity:number('sensitivity',.25,2.5,1),fov:value.fov===0||value.fov==='0'?0:number('fov',65,100,0),
  quality:['balanced','performance'].includes(value.quality)?value.quality:'balanced',
  motion:['system','reduced'].includes(value.motion)?value.motion:'system'};
}
export function readPreferences(storage){try{return sanitizePreferences(JSON.parse(storage.getItem(PREFERENCE_KEY)));}catch{return {...DEFAULT_PREFERENCES};}}
export function writePreferences(storage,value){try{storage.setItem(PREFERENCE_KEY,JSON.stringify(sanitizePreferences(value)));return true;}catch{return false;}}
export function pixelRatioFor(quality,coarse,dpr=1){return Math.min(Math.max(.5,Number.isFinite(dpr)?dpr:1),quality==='performance'?.85:coarse?1.25:1.65);}
export function baseFov(preferences,coarse){return preferences.fov|| (coarse?84:76);}
/** Paused/menu scenes are static; throttle rendering without throttling play. */
export function shouldRender(now,last,playing,hidden){return !hidden&&(playing||now-last>=100);}
