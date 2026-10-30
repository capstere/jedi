import * as THREE from 'three';
export function controlReadout(game){
 const f=game.state.combatFlow,z=f?.zones[f.index];
 if(!z)return 'KONTROLLZON · INGET GÅNGBART MÅL';
 const label=String.fromCharCode(65+f.index);
 const status=f.contested?'OMSTRIDD · INGA POÄNG':f.capturing
  ?`${f.capturing===game.player.team?'VI':'FIENDEN'} ERÖVRAR ${Math.floor(f.progress*100)}%`
  :f.owner?(f.owner===game.player.team?'VÅR ZON':'FIENDENS ZON')+(f.occupants.length?' · +1/s':' · TOM'):'ERÖVRA · STÅ PÅ MARKEN';
 return `${label} · ${status} · BYTE ${Math.max(0,Math.ceil(f.rotateAt-game.state.time))}s`;
}
/** Two reused meshes; objective-only presentation, no collision or game writes. */
export class ControlZoneView{
 constructor(scene){
  this.root=new THREE.Group();this.root.name='control-zone';scene.add(this.root);
  this.material=new THREE.MeshBasicMaterial({color:0xffe07a,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
  this.ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,64),this.material);
  this.ring.rotation.x=-Math.PI/2;this.root.add(this.ring);
  this.beacon=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2,8),this.material);
  this.beacon.position.y=1;this.root.add(this.beacon);this.root.visible=false;
 }
 update(game){
  const f=game?.state.combatFlow,z=f?.zones[f.index];this.root.visible=!!z;
  if(!z)return;
  this.root.position.set(z.x,.04,z.z);this.ring.scale.setScalar(z.radius);
  this.material.color.set(f.contested?0xffffff:f.owner==='analysts'?0x77eee0:f.owner==='counterAnalysts'?0xf89e63:0xffe07a);
  this.material.opacity=f.contested?.55+.25*Math.sin(game.state.time*6):.8;
 }
}
