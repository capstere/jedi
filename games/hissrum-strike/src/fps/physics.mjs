// Narrow math adapter: the original Cartridge Strike bot module imports
// distanceSegment from physics.mjs. All actual room collision is handled by
// ../world.mjs against the imported GLB triangle octree, not proxy walls.
export function distanceSegment(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
