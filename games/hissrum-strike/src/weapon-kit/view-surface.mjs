/** Local authored first-person surface treatment; no new model downloads.
 * View-only cloned materials: world/bot weapons and ammunition remain untouched.
 * Continuous object-space grain avoids stretching the existing bevel UVs.
 */
import * as THREE from 'three';
const owned=new Set();
const vertex=`varying vec3 vFinishPosition;`;
export function surfaceKind(material){
  if(material.name==='quality-glove')return 'cloth';
  if(material.metalness>.55)return 'metal';
  const c=material.color;
  if(c&&c.r>c.g*1.35&&c.g>c.b*1.12&&material.roughness<.7)return 'wood';
  return 'polymer';
}
function finish(source){
  const m=source.clone(),kind=surfaceKind(source),old=source.onBeforeCompile,key=source.customProgramCacheKey();
  m.name=`view-finish-${kind}`;m.userData={...source.userData,sharedWeapon:true,viewFinish:kind};
  if(kind==='metal'){m.metalness=.88;m.roughness=.38;m.envMapIntensity=1.1;m.color.multiplyScalar(.86);}
  if(kind==='polymer'){m.roughness=.79;m.envMapIntensity=.5;}
  if(kind==='wood'){m.roughness=.53;m.envMapIntensity=.7;}
  m.onBeforeCompile=(s,r)=>{
    old.call(m,s,r);
    s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\n${vertex}`)
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\n${vertex}
      float finishHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `);
    const effect=kind==='wood'?`
      float grain=finishNoise(vFinishPosition*vec3(95.0,70.0,5.0));
      float veins=.5+.5*sin(vFinishPosition.x*640.0+grain*7.0);
      diffuseColor.rgb*=mix(.67,1.12,veins);roughnessFactor=clamp(roughnessFactor+grain*.16,.35,.85);`
      :kind==='metal'?`
      float grain=finishNoise(vFinishPosition*vec3(240.0,240.0,18.0));
      float abrasion=finishNoise(vFinishPosition*vec3(28.0,28.0,4.0));
      diffuseColor.rgb*=mix(.88,1.09,abrasion);roughnessFactor=clamp(roughnessFactor+grain*.13,.26,.65);`
      :`
      float grain=finishNoise(vFinishPosition*220.0);
      diffuseColor.rgb*=mix(.93,1.04,grain);roughnessFactor=clamp(roughnessFactor+grain*.06,.6,1.0);`;
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${effect}`);
  };
  m.customProgramCacheKey=()=>key+'|view-finish-v1-'+kind;m.needsUpdate=true;owned.add(m);return m;
}
export function upgradeViewSurfaces(model){
  if(!model.userData.viewmodel||model.userData.viewSurfaces)return;
  // Cartridge-labelled grenades/objectives must retain their approved appearance.
  if(['bomb','smoke','flash','he'].includes(model.userData.id))return;
  const copies=new Map();model.traverse(o=>{
    if(!o.isMesh||!o.material?.isMeshStandardMaterial||o.material.transparent||o.material.map)return;
    const source=o.material;if(!copies.has(source))copies.set(source,finish(source));o.material=copies.get(source);
  });
  model.userData.viewSurfaces={materials:copies.size,kind:'original-object-space-finish'};
}
export function inspectPose(elapsed,{cancel=false,reducedMotion=false}={}){
  if(cancel||!Number.isFinite(elapsed)||elapsed<=0||elapsed>=2.15||reducedMotion)return {position:[0,0,0],rotation:[0,0,0]};
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const amount=ease(elapsed/.42)*(1-ease((elapsed-1.55)/.6));
  return {position:[-.035*amount,.055*amount,.03*amount],rotation:[.12*amount,-.38*amount,.42*amount]};
}
export function disposeViewSurfaces(){for(const m of owned)m.dispose();owned.clear();}
