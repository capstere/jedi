/** Presentation-only buffers. The actual trajectory still comes from Game physics. */
const TYPES=new Set(['he','smoke','flash']);
export function canPreviewGrenade(game,enabled=true){
 const p=game?.player;
 return !!(enabled&&p?.alive&&!game?.state?.paused&&!p.vehicleId&&
   TYPES.has(p.weapon)&&p.inventory?.[p.weapon]>0);
}

/** Stable Float32 storage, matching the coordinates actually sent to WebGL.
 * No new attribute, sliced path or per-point array on refresh. Unused tail
 * entries are never drawn; count is the sole draw-range authority.
 */
export class GrenadePreviewBuffer{
 constructor(capacity=64){
  if(!Number.isInteger(capacity)||capacity<2)throw new RangeError('Preview needs at least two points');
  this.positions=new Float32Array(capacity*3);
  this.distances=new Float32Array(capacity);
  this.count=0;
 }
 write(path){
  let count=Math.min(path?.length??0,this.distances.length);
  if(count<2)count=0;
  // Fail closed on a malformed path instead of uploading NaN/Infinity or
  // drawing a line across a missing point. Validation does not allocate.
  for(let i=0;i<count;i++){
   const p=path[i];
   if(!p||!Number.isFinite(Math.fround(p.x))||!Number.isFinite(Math.fround(p.y))||
     !Number.isFinite(Math.fround(p.z))){count=0;break;}
  }
  let changed=count!==this.count;
  for(let i=0;i<count;i++){
   const p=path[i],j=i*3,x=Math.fround(p.x),y=Math.fround(p.y),z=Math.fround(p.z);
   if(this.positions[j]!==x||this.positions[j+1]!==y||this.positions[j+2]!==z){
    this.positions[j]=x;this.positions[j+1]=y;this.positions[j+2]=z;changed=true;
   }
  }
  this.count=count;
  if(!changed||count===0)return changed;
  let length=0;this.distances[0]=0;
  for(let i=1;i<count;i++){
   const j=i*3;
   length+=Math.hypot(this.positions[j]-this.positions[j-3],
     this.positions[j+1]-this.positions[j-2],this.positions[j+2]-this.positions[j-1]);
   this.distances[i]=length;
  }
  return true;
 }
 reset(){this.count=0;}
}
