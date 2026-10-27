/** Presentation-only lifecycle. The visitor may update an item's transform or
 * velocity, but must not add/remove items or acquire batch slots. Stable order
 * preserves transparent blending, oldest-first eviction and instance slots.
 * No snapshots, indexOf scans or splice shifts are needed for frame cleanup.
 */
export function compactEffectItems(items,time,bloodOff,advance,context,dt=0,camera=null){
 const count=items.length;
 let write=0;
 for(let read=0;read<count;read++){
  const item=items[read];
  // Preserve the old strict expiry boundary: a mark lives at time === until.
  const discard=(bloodOff&&item.kind.startsWith('blood'))||time>item.until;
  if(!discard&&advance.call(context,item,dt,camera)!==false){
   if(write!==read)items[write]=item;
   write++;
  }else{
   item.batch.release(item.mesh);
  }
 }
 if(write!==count)items.length=write;
 return count-write;
}

/** Keep the existing array and reusable batch transforms across round resets. */
export function clearEffectItems(items){
 const count=items.length;
 for(let i=0;i<count;i++)items[i].batch.release(items[i].mesh);
 if(count)items.length=0;
 return count;
}
