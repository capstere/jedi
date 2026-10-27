/** Real Three.js integration; runs in Chromium, not mocked geometry. */
import * as THREE from 'three';
import {GrenadeView} from '../src/grenade-view.mjs';
import {CONFIG} from '../src/fps/config.mjs';
function check(ok,message){if(!ok)throw new Error(message);}
export function runGrenadeViewChecks(){
 let rays=0;
 const world={raycast:()=>{rays++;return null;}};
 const scene=new THREE.Scene(),view=new GrenadeView(scene,world);
 const game={player:{id:'human',x:0,y:0,z:0,height:1.7,pitch:.3,yaw:0,
  alive:true,isPlayer:true,weapon:'he',inventory:{he:1},vehicleId:null},
  config:{...CONFIG,playerGrenadeSpeed:17},state:{time:0,paused:false,grenades:[]}};
 view.update(game);
 const position=view.buffer.getAttribute('position'),distance=view.buffer.getAttribute('lineDistance');
 const pv=position.version,dv=distance.version;
 check(view.line.visible&&view.pointCount>2,'valid trajectory should be visible on first frame');
 const initialRays=rays;
 for(let i=1;i<=600;i++){game.state.time=i*.26;view.update(game);}
 check(view.buffer.getAttribute('position')===position&&view.buffer.getAttribute('lineDistance')===distance,'attributes were replaced');
 check(position.version===pv&&distance.version===dv,'unchanged preview caused extra GPU uploads');
 check(rays>initialRays*500,'collision still must be checked; no stale-world memoization');
 // Compare our distances against Three r180's original algorithm, valid prefix only.
 const reference=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());
 reference.geometry.setAttribute('position',new THREE.BufferAttribute(position.array.slice(0,view.pointCount*3),3));
 reference.computeLineDistances();
 const expected=reference.geometry.getAttribute('lineDistance').array;
 for(let i=0;i<expected.length;i++)check(Math.abs(expected[i]-distance.array[i])<.00001,'dash spacing changed');
 reference.geometry.dispose();reference.material.dispose();
 game.player.pitch+=.25;game.state.time+=.26;view.update(game);
 check(position.version>pv,'aim change must update the route');
 // The preview must never simulate an infantry throw from the tank cannon.
 game.player.vehicleId='cartridge-tank';view.update(game);
 check(!view.line.visible&&!view.end.visible&&view.pointCount===0,'tank still shows infantry grenade guide');
 const grenade={id:'g1',type:'he',x:1,y:1,z:-2};game.state.grenades=[grenade];view.update(game,false);
 const mesh=view.live.get('g1');check(mesh?.visible,'already-thrown grenade hidden by tank/settings');
 game.player.vehicleId=null;view.update(game);
 check(view.line.visible,'dismount should refresh immediately at the same simulation time');
 game.state.paused=true;view.update(game);check(!view.line.visible,'pause must hide guide');
 game.state.paused=false;view.update(game);check(view.line.visible,'resume must restore guide');
 // Preserve the same mesh even when expiry and launch occur in a single frame.
 game.state.grenades=[{...grenade,id:'g2',type:'flash'}];view.update(game);
 check(view.live.get('g2')===mesh,'expired mesh was not recycled before spawn');
 check(mesh.material===view.materials.flash,'pooled grenade retained previous type');
 const ids=view.ids;
 for(let i=0;i<100;i++){
  view.clear();check(scene.children.length===2,'reset left ghost projectile in scene');
  game.state.time=0;game.state.grenades=[grenade];view.update(game);
  check(view.live.get('g1')===mesh,'round restart discarded the warm mesh pool');
  check(view.ids===ids,'frame membership set was replaced');
 }
 game.state.grenades=Array.from({length:30},(_,i)=>({...grenade,id:'many-'+i}));view.update(game);
 check(view.live.size===30,'pool capacity must not cap real visible grenades');
 game.state.grenades=[];view.update(game);
 check(view.pool.length===12&&scene.children.length===2,'inactive mesh pool is not bounded');
 game.state.time=100;view.update(game);game.state.time=0;view.update(game);
 check(view.line.visible,'clock reset left preview waiting for the prior round');
 let released=0;
 const resources=[view.buffer,view.line.material,view.end.geometry,view.end.material,view.geometry,...Object.values(view.materials)];
 for(const r of resources)r.addEventListener('dispose',()=>released++);
 view.dispose();view.dispose();view.update(game);
 check(scene.children.length===0&&view.pool.length===0,'dispose left scene nodes or cache');
 check(released===resources.length,'shared GPU resources must be disposed exactly once');
 return {three:THREE.REVISION,unchangedPreviewRefreshes:600,extraAttributeUploads:0,
  restartCycles:100,reusedGrenadeMesh:true,maxInactivePool:12,resourcesDisposed:released};
}
