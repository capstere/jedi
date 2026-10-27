/** Original procedural Cartridge vehicle: small white assay cartridge hull,
 * blue armored skirt, teal lid/turret, rubber tracks. No external assets.
 * A fixed-size pool renders cannon rounds, recoil, damage and wreck animation.
 */
import * as THREE from 'three';
export class CartridgeTankView {
 constructor(scene){
  this.scene=scene;this.root=new THREE.Group();this.root.name='Cartridge tank';scene.add(this.root);
  this.owned=[];this.wheels=[];this.labelTexture=null;
  const material=(color,metalness=.2)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.55,metalness});this.owned.push(m);return m;};
  this.white=material('#e8eee8');this.blue=material('#16445c',.65);this.teal=material('#55ccbc',.4);
  const rubber=material('#19242c'),metal=material('#617d88',.7),black=material('#172b34');
  const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{
   const m=new THREE.Mesh(geometry,mat);this.owned.push(geometry);m.position.set(x,y,z);parent.add(m);return m;
  };
  const box=(p,w,h,d,m,x,y,z)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  this.hull=new THREE.Group();this.root.add(this.hull);
  box(this.hull,1.18,.25,1.74,this.blue,0,.4,0);
  box(this.hull,.95,.71,1.28,this.white,0,.84,0);
  box(this.hull,1.06,.11,1.39,this.teal,0,1.25,0);
  box(this.hull,.76,.20,.24,this.blue,0,.95,-.72);
  for(const x of [-.65,.65]){
   box(this.hull,.29,.48,1.86,rubber,x,.34,0);
   for(const z of [-.68,-.23,.23,.68]){
    const w=mesh(this.hull,new THREE.CylinderGeometry(.19,.19,.32,10),metal,x,.34,z);
    w.rotation.z=Math.PI/2;this.wheels.push(w);
   }
   for(const z of [-.66,0,.66])box(this.hull,.31,.055,.23,this.blue,x,.60,z);
   box(this.hull,.18,.09,.10,this.teal,x,.72,-.94);
  }
  // A cartridge-like reagent port and printed diagnostic label distinguish it
  // from a generic military tank while preserving the miniature room scale.
  mesh(this.hull,new THREE.CylinderGeometry(.19,.19,.12,14),black,.24,1.36,.37);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#edf4ee';ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#17445a';ctx.font='bold 45px sans-serif';ctx.fillText('CARTRIDGE',24,65);
  ctx.font='bold 25px sans-serif';ctx.fillText('ARMORED  •  C-12',26,104);
  ctx.fillStyle='#2f998e';ctx.fillRect(24,130,460,12);
  for(let i=0;i<67;i++){ctx.fillStyle='#163b4b';ctx.fillRect(26+i*6.7,163,1+i%4,51);}
  this.labelTexture=new THREE.CanvasTexture(canvas);this.labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.MeshBasicMaterial({map:this.labelTexture,side:THREE.DoubleSide});this.owned.push(label);
  for(const side of [-1,1]){
   const p=mesh(this.hull,new THREE.PlaneGeometry(1.05,.53),label,side*.482,.88,.02);
   p.rotation.y=side*Math.PI/2;
  }
  this.turret=new THREE.Group();this.turret.position.y=1.5;this.hull.add(this.turret);
  mesh(this.turret,new THREE.CylinderGeometry(.34,.43,.22,16),this.blue,0,-.06,0);
  box(this.turret,.53,.22,.58,this.teal,0,.10,0);
  this.barrel=new THREE.Group();this.turret.add(this.barrel);
  const barrel=mesh(this.barrel,new THREE.CylinderGeometry(.075,.10,1.02,12),metal,0,.0,-.68);barrel.rotation.x=Math.PI/2;
  const end=mesh(this.barrel,new THREE.CylinderGeometry(.11,.11,.15,12),black,0,0,-1.23);end.rotation.x=Math.PI/2;
  this.flash=mesh(this.barrel,new THREE.IcosahedronGeometry(.19,0),new THREE.MeshBasicMaterial({color:'#fff1ab'}),0,0,-1.40);
  this.owned.push(this.flash.material);this.flash.visible=false;
  this.pad=new THREE.Mesh(new THREE.RingGeometry(1.35,1.43,36),new THREE.MeshBasicMaterial({color:'#70e8d0',transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false}));
  this.pad.rotation.x=-Math.PI/2;scene.add(this.pad);this.owned.push(this.pad.geometry,this.pad.material);
  this.shells=[];
  const bulletGeo=new THREE.SphereGeometry(.095,8,5),bulletMat=new THREE.MeshBasicMaterial({color:'#ffdb80'});
  this.owned.push(bulletGeo,bulletMat);
  for(let i=0;i<8;i++){const m=new THREE.Mesh(bulletGeo,bulletMat);m.visible=false;scene.add(m);this.shells.push(m);}
 }
 update(game){
  const t=game?.state.tank;this.root.visible=!!t;this.pad.visible=!!t;
  if(!t){for(const s of this.shells)s.visible=false;return;}
  const now=game.state.time,dead=t.destroyedAt===null?-1:now-t.destroyedAt;
  this.root.position.set(t.x,0,t.z);this.root.rotation.y=t.yaw;
  this.hull.rotation.set(0,0,0);this.hull.position.set(0,0,0);
  this.turret.position.set(0,1.5,0);this.turret.rotation.set(0,t.turretYaw-t.yaw,0);
  this.barrel.rotation.x=t.pitch;this.barrel.position.z=Math.max(0,1-(now-t.lastShot)/.2)*.14;
  this.flash.visible=t.alive&&now-t.lastShot<.095;
  const scorched=!t.alive;
  this.white.color.set(scorched?'#39464c':'#e8eee8');this.teal.color.set(scorched?'#313f45':'#55ccbc');
  this.white.emissive.set(t.alive&&now-t.hitAt<.10?'#b95225':'#000000');
  for(const w of this.wheels)w.rotation.x=t.odometer/.19;
  if(dead>=0){
   // Turret kicks up, tips, then settles on the visibly burnt cartridge hull.
   const hop=Math.max(0,Math.sin(Math.min(1,dead/1.1)*Math.PI))*.6;
   this.hull.rotation.z=Math.min(.12,dead*.18);
   this.turret.position.y=1.36+hop;this.turret.rotation.z=Math.min(.65,dead*.8);
   this.barrel.rotation.x=-.3;this.flash.visible=false;
  }
  this.pad.position.set(t.home.x,.045,t.home.z);
  this.pad.material.opacity=scorched?.2+.15*Math.sin(now*4):.32;
  for(let i=0;i<this.shells.length;i++){
   const p=game.state.tankShells?.[i],m=this.shells[i];m.visible=!!p;if(p)m.position.set(p.x,p.y,p.z);
  }
 }
 dispose(){this.scene.remove(this.root,this.pad,...this.shells);for(const r of this.owned)r.dispose?.();this.labelTexture?.dispose();}
}
