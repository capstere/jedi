/** Animate Cartridge Strike's real Quaternius Death01 skinned clip.
 * One mixer per existing avatar; no separate placeholder ragdolls, random
 * physics, or modifications to authoritative combat/death state.
 */
import * as THREE from 'three';
import {deathMotion} from './death-motion.mjs';
import {posedBounds} from './character-library.mjs';

export const CORPSE_VISIBLE_SECONDS=6.5;
export const PLAYER_DEATH_CAMERA_SECONDS=1.65;
export function deathAge(actor,time){
  return actor?.alive===false&&Number.isFinite(actor?.deathAt)
    ?time-actor.deathAt:Infinity;
}
export function corpseShouldShow(actor,time){
 const age=deathAge(actor,time);
 return age>=0&&age<CORPSE_VISIBLE_SECONDS;
}
export function startAuthoredDeath(avatar,actor){
 if(!avatar||!Number.isFinite(actor?.deathAt))return false;
 if(avatar.death?.at===actor.deathAt)return true;
 avatar.mixer.stopAllAction();
 const clip=avatar.clips.get('Death01');
 if(!clip)throw new Error('Cartridge Strike Quaternius Death01 animation missing');
 const action=avatar.mixer.clipAction(clip);
 action.reset().setLoop(THREE.LoopOnce,1).play();
 action.clampWhenFinished=true;
 avatar.death={at:actor.deathAt,action,lastFloorSample:-1,floorOffset:avatar.groundOffset};
 avatar.time=null;avatar.activeBase=null;avatar.activeUpper=null;
 return true;
}
export function poseAuthoredDeath(avatar,actor,time){
 const age=deathAge(actor,time);
 if(!(age>=0&&age<CORPSE_VISIBLE_SECONDS))return false;
 startAuthoredDeath(avatar,actor);
 const duration=avatar.death.action.getClip().duration;
 const reaction=deathMotion(actor,age);
 const posedTime=Math.min(duration-.001,Math.max(0,reaction.progress*duration));
 avatar.mixer.setTime(posedTime);
 avatar.holder.rotation.set(reaction.pitch,Math.PI,reaction.roll);
 avatar.holder.scale.setScalar(avatar.scale);
 // Sample posed geometry at most five times during the fall, then retain its
 // settled bounds to keep death animations cheap for many bots on iPhones.
 const bucket=Math.min(8,Math.floor(age/.19));
 if(bucket!==avatar.death.lastFloorSample){
   avatar.root.updateMatrixWorld(true);
   const bounds=posedBounds(avatar.root);
   avatar.death.floorOffset=Number.isFinite(bounds.min.y)
     ?-.0-bounds.min.y*avatar.scale+.004:avatar.groundOffset;
   avatar.death.lastFloorSample=bucket;
 }
 avatar.holder.position.set(0,avatar.death.floorOffset,0);
 avatar.root.updateWorldMatrix(true,true);
 return true;
}
export function resumeAuthoredAfterRespawn(avatar){
 if(!avatar?.death)return;
 avatar.mixer.stopAllAction();
 avatar.death=null;
 avatar.time=null;avatar.x=null;avatar.z=null;
 avatar.activeBase=null;avatar.activeUpper=null;
 avatar.holder.position.set(0,avatar.groundOffset,0);
 avatar.holder.rotation.set(0,Math.PI,0);
}
