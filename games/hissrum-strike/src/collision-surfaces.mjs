/** Visible floor markings are NOT physical obstacles.
 * The authentic Hissrum V5 GLB exports tape as thin raised triangles. Including
 * them in the authoritative capsule octree creates invisible blocking lines.
 * Keep every tape mesh in the render scene; omit only its triangles from
 * collision and projectile raycasts. All structural meshes remain solid.
 */
export function isDecorativeFloorMarking(mesh) {
  let node=mesh;
  while(node){
    if(/Golvtejp|floor[_\s-]?tape|floorMarking/i.test(node.name||'')) return true;
    node=node.parent;
  }
  const materials=Array.isArray(mesh?.material)?mesh.material:[mesh?.material];
  return materials.some(m=>/floor[_\s-]?tape|Golvtejp/i.test(m?.name||''));
}
