/** Map-derived neutral first contact. No changed topology, starts or hidden enemy data. */
export function routeLength(from,route){let length=0,previous=from;for(const p of route){length+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}return length;}
export function neutralOpening(world){
 const a=world.anchors?.analysts?.[0],b=world.anchors?.counterAnalysts?.[0];if(!a||!b||!world.navigation?.nodes)return null;
 const route=world.findPath(a,b);if(!route.length)return null;
 const half=routeLength(a,route)/2;let elapsed=0,previous=a,mid=a;
 for(const p of route){const d=Math.hypot(p.x-previous.x,p.z-previous.z);if(elapsed+d>=half){const t=(half-elapsed)/Math.max(.001,d);mid={x:previous.x+(p.x-previous.x)*t,z:previous.z+(p.z-previous.z)*t};break;}elapsed+=d;previous=p;}
 // Sample a small, reproducible candidate set around the actual walking midpoint.
 const candidates=world.navigation.nodes.filter(n=>Math.hypot(n.x-mid.x,n.z-mid.z)<8&&world.canOccupy(n.x,n.z,.62,1.72,0));
 candidates.sort((p,q)=>Math.hypot(p.x-mid.x,p.z-mid.z)-Math.hypot(q.x-mid.x,q.z-mid.z));
 let best=null;
 for(const p of candidates.slice(0,24)){
  const pa=world.findPath(a,p),pb=world.findPath(b,p);if(!pa.length||!pb.length)continue;
  const da=routeLength(a,pa),db=routeLength(b,pb),difference=Math.abs(da-db),score=difference*3+Math.max(da,db);
  if(!best||score<best.score)best={p,da,db,difference,score};
 }
 if(!best||best.difference>6)return null; // fail back to known room zones rather than inventing geometry
 const room=world.roomAt(best.p.x,best.p.z);if(!room)return null;
 return {id:'neutral-opening',name:`${room.name} · MÖTESPUNKT`,x:best.p.x,y:0,z:best.p.z,radius:2.5,
   deployment:{analysts:best.da,counterAnalysts:best.db,source:'existing-walkable-shortest-routes',verifiedMetricScale:false}};
}
