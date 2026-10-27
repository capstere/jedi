/**
 * Actual Cartridge Strike first-person weapons + hands, ported from the
 * original game. Everything is visual: Hissrum's Game still owns combat,
 * ammo, magazine count, aim, recoil and death.
 *
 * p9/p12/cr4 use the original Quaternius CC0 skinned hands (Strike Kit).
 * Other weapons use Cartridge Strike's original full 3D weapon primitives
 * with fitted continuous glove presentation shells.
 */
import {kitWeapon} from './strike-kit-timing.mjs';
import {makeKitWeapon,animateKitWeapon,disposeKitModels} from './strike-kit-models.mjs';
import {makeWeapon as primitiveWeapon,animateWeapon as animatePrimitiveWeapon,
  disposeWeaponResources as disposePrimitiveResources} from './model-primitives.mjs';
import {fitPresentationHands,disposePresentationHands} from './presentation-hands.mjs';
import {upgradeViewSurfaces,disposeViewSurfaces} from './view-surface.mjs';
import {createViewMotion,viewMotion} from './presentation-motion.mjs';

export const VIEWMODEL_SOURCE='capstere/cartridge-strike';
export function createStrikeViewWeapon(id){
  const hero=kitWeapon(id);
  const model=hero?makeKitWeapon(id):primitiveWeapon(id,{viewmodel:true});
  if(!model)throw new Error('Missing Cartridge Strike viewmodel for '+id);
  if(!hero){fitPresentationHands(model);upgradeViewSurfaces(model);}
  model.userData.presentationMotion=createViewMotion();
  model.userData.hissrumSource=VIEWMODEL_SOURCE;
  model.userData.originalStrikeKit=hero;
  return model;
}
export function animateStrikeViewWeapon(model,actor,time,dt,{shotAt=-Infinity,
   switchAt=-Infinity,recoil=0,reducedMotion=false}={}){
  const params={shotAt,switchAt,recoil,reducedMotion};
  const pose=model.userData.heroKit
    ?animateKitWeapon(model,actor,time,dt,params)
    :animatePrimitiveWeapon(model,actor,time,dt,params);
  const state=model.userData.presentationMotion;
  if(state){
    const offset=viewMotion(state,actor,time,{weapon:model.userData.id,
      shotAt,reducedMotion});
    model.position.x+=offset.position[0];model.position.y+=offset.position[1];
    model.position.z+=offset.position[2];
    model.rotation.x+=offset.rotation[0];model.rotation.y+=offset.rotation[1];
    model.rotation.z+=offset.rotation[2];
  }
  model.updateMatrixWorld(true);
  // Exactly the original animated muzzle socket. Do not move physics raycast.
  return {...pose,muzzle:model.localToWorld(model.userData.muzzle.clone())};
}
export function disposeStrikeViewWeapons(){
  disposeKitModels();disposeViewSurfaces();disposePresentationHands();
  disposePrimitiveResources();
}
