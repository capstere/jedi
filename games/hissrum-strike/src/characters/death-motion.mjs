/** Deterministic visible death phases; no changes to HP, aim, AI or scoring. */
export function deathMotion(actor,age){
 const cause=actor?.deathCause||{},heavy=['ram','cannon','bazooka','he','tank-wreck'].includes(cause.weapon);
 const duration=heavy?1.05:cause.head?1.18:1.48;
 const progress=Math.max(0,Math.min(1,age/duration));
 const d=cause.direction||{x:0,z:0},yaw=actor?.yaw||0;
 const side=Math.max(-1,Math.min(1,(d.x||0)*Math.cos(yaw)-(d.z||0)*Math.sin(yaw)));
 const pulse=age>=.30?0:Math.sin(Math.min(1,Math.max(0,age)/.30)*Math.PI);
 return {duration,progress,roll:side*pulse*(heavy?.19:.09),
   pitch:-pulse*(cause.head?.12:.065),airDrop:Math.max(0,4.9*age*age),
   phase:age<.22?'impact':progress<1?'fall':'settled',heavy};
}
