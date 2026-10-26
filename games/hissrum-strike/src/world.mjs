/**
 * GLB-only environment adapter for Cartridge Strike's authoritative Game.
 * The room's reference floor is Y=0 in the source GLB (the structural base
 * reaches Y=-0.19). Never translate the model by its absolute bottom: that
 * would leave the player standing UNDER the finished floor.
 * Scale 6x keeps the players approximately 28 cm tall inside the real room.
 */
import * as THREE from 'three';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {Octree} from '../vendor/three/addons/math/Octree.js';
import {Capsule} from '../vendor/three/addons/math/Capsule.js';
import {createNavigation,selectAnchors} from './navigation.mjs';

export const ROOM_MODEL='Hissrum12_V5_med_39_objekt.glb';
export const MINIATURE_SCALE=6;
const EPS=.0001;
const position=new THREE.Vector3();
const ray=new THREE.Ray();
const rayDir=new THREE.Vector3();
const hitPoint=new THREE.Vector3();
const cap=new Capsule();
const normal=new THREE.Vector3();
const floorKey=(x,z)=>Math.floor(x/4)+','+Math.floor(z/4);

function makeFloorIndex(group){
  const floor=new Map();let polygons=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  group.updateWorldMatrix(true,true);
  group.traverse(object=>{
    if(!object.isMesh || !object.geometry?.attributes?.position)return;
    const g=object.geometry,pos=g.getAttribute('position'),idx=g.index;
    const count=idx?idx.count:pos.count;
    for(let i=0;i+2<count;i+=3){
      a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(object.matrixWorld);
      const yMin=Math.min(a.y,b.y,c.y),yMax=Math.max(a.y,b.y,c.y);
      // Only the genuine model floor; tabletops and suspended assets cannot
      // create fictional walkable islands below the player's feet.
      if(yMin<-.14||yMax>.22||yMax-yMin>.15)continue;
      const area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
      if(Math.abs(area)<.0005)continue;
      const p={ax:a.x,az:a.z,bx:b.x,bz:b.z,cx:c.x,cz:c.z,area};
      const minX=Math.floor(Math.min(a.x,b.x,c.x)/4),maxX=Math.floor(Math.max(a.x,b.x,c.x)/4);
      const minZ=Math.floor(Math.min(a.z,b.z,c.z)/4),maxZ=Math.floor(Math.max(a.z,b.z,c.z)/4);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
        const k=x+','+z,cell=floor.get(k)||[];cell.push(p);floor.set(k,cell);
      }
      polygons++;
    }
  });
  function supports(x,z){
    const list=floor.get(floorKey(x,z));if(!list)return false;
    for(const p of list){
      const d1=(p.bx-p.ax)*(z-p.az)-(p.bz-p.az)*(x-p.ax);
      const d2=(p.cx-p.bx)*(z-p.bz)-(p.cz-p.bz)*(x-p.bx);
      const d3=(p.ax-p.cx)*(z-p.cz)-(p.az-p.cz)*(x-p.cx);
      if(p.area>0?d1>=-EPS&&d2>=-EPS&&d3>=-EPS:d1<=EPS&&d2<=EPS&&d3<=EPS)return true;
    }
    return false;
  }
  return {supports,polygons};
}

export async function createHissrumWorld(progress=()=>{}){
  const modelUrl=new URL('../../../'+ROOM_MODEL,import.meta.url);
  progress('Laddar originalmodellen (39 objekt)…');
  const gltf=await new GLTFLoader().loadAsync(modelUrl.href,ev=>{
    if(ev.total>0)progress('Laddar modellen · '+Math.round(100*ev.loaded/ev.total)+' %');
  });
  if(!gltf.scene)throw Error('GLB has no scene');
  const model=gltf.scene;
  model.name='Hissrum 12 · authentic V5 + 39 objects';
  model.scale.setScalar(MINIATURE_SCALE);
  model.updateMatrixWorld(true);
  const fullBounds=new THREE.Box3().setFromObject(model);
  if(fullBounds.isEmpty())throw Error('GLB contained no geometry');
  // The exported room has a structural plinth below Y=0 and a complete freight
  // elevator outside its north wall. Neither must establish the floor height
  // or the playable room footprint. Anchor to the physical BASE TOP, not the
  // absolute minimum Y of the entire exported scene.
  const base=model.getObjectByName('base__trim');
  if(!base)throw Error('Hissrum V5 base__trim reference not found');
  const roomBounds=new THREE.Box3().setFromObject(base);
  const floorReference=roomBounds.max.y;
  model.position.y-=floorReference;
  model.updateMatrixWorld(true);
  roomBounds.translate(new THREE.Vector3(0,-floorReference,0));
  const bounds=roomBounds.clone();
  bounds.min.y=0;
  bounds.max.y=fullBounds.max.y-floorReference;
  if(bounds.max.z-bounds.min.z>MINIATURE_SCALE*8.5 || bounds.max.x-bounds.min.x>MINIATURE_SCALE*8.5)
    throw Error('Unexpected Hissrum 12 room bounds from base__trim');
  progress('Analyserar verkligt golv och kollisionsytor…');
  const floor=makeFloorIndex(model);
  if(!floor.polygons)throw Error('Inga plana golvtrianglar hittades i GLB. Kontrollera 3D-exporten.');
  const octree=new Octree();
  octree.trianglesPerLeaf=28;
  octree.maxLevel=8;
  octree.fromGraphNode(model);
  const landmarks=[];
  const landmarkName=/creform|pall|tvättvagn|sopkärl|plastlåda|torr-is|kvävetank|palltruck|kyl/i;
  const stats={floorTriangles:floor.polygons,meshCount:0,model:ROOM_MODEL,
    scale:MINIATURE_SCALE,floorReference,roomExtent:{
      x:bounds.max.x-bounds.min.x,z:bounds.max.z-bounds.min.z}};
  model.traverse(o=>{
    if(o.isMesh)stats.meshCount++;
    // Use the ORIGINAL friendly GLB object/group names. A glTF mesh's
    // generated V4_pallet/V4_creform... primitive name is not a useful
    // map label and produces duplicate footprints for every material piece.
    if(!o.name || /^V4_/i.test(o.name) || !landmarkName.test(o.name))return;
    if(!o.isMesh&&!o.children.length)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const center=box.getCenter(new THREE.Vector3());
    landmarks.push({name:o.name,x:center.x,y:center.y,z:center.z,
      min:{x:box.min.x,z:box.min.z},max:{x:box.max.x,z:box.max.z}});
  });
  function inside(x,z,r=0){
    return x>=bounds.min.x+r&&x<=bounds.max.x-r&&z>=bounds.min.z+r&&z<=bounds.max.z-r;
  }
  function ground(x,z,r=0){
    if(!floor.supports(x,z))return false;
    if(r>.05){const e=Math.min(.16,r*.65);
      if(!floor.supports(x+e,z)||!floor.supports(x-e,z)||!floor.supports(x,z+e)||!floor.supports(x,z-e))return false;
    }
    return true;
  }
  function intersects(x,z,r=.2,h=1.7,y=0){
    cap.radius=r;
    cap.start.set(x,y+r+.032,z);
    cap.end.set(x,y+Math.max(r,h-r)+.032,z);
    const collision=octree.capsuleIntersect(cap);
    return Boolean(collision&&collision.depth>.015);
  }
  function canOccupy(x,z,r=.2,h=1.7,y=0){
    if(![x,z,r,h,y].every(Number.isFinite)||r<=0||h<r*2)return false;
    if(!inside(x,z,r+.015))return false;
    if(y<.3&&!ground(x,z,r))return false;
    if(y<-.001||y+h>bounds.max.y+2)return false;
    return !intersects(x,z,r,h,y);
  }
  function canTravel(a,b,r=.25,h=1.72){
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    const steps=Math.max(1,Math.ceil(d/(r*1.75)));
    for(let j=0;j<=steps;j++){
      const t=j/steps;
      if(!canOccupy(a.x+dx*t,a.z+dz*t,r,h,0))return false;
    }
    return true;
  }
  function move(actor,dx,dy,dz){
    const result={collision:false,onGround:false,ceiling:false};
    if(![dx,dy,dz].every(Number.isFinite)||Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))>5)return result;
    const radius=actor.radius||.2,height=actor.height||1.7;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz,dy)/.24));
    for(let i=0;i<steps;i++){
      const prevY=actor.y??0,nextY=Math.max(0,prevY+dy/steps);
      const testY=canOccupy(actor.x,actor.z,radius,height,nextY)?nextY:prevY;
      if(testY===prevY&&Math.abs(nextY-prevY)>EPS){
        if(dy>0)result.ceiling=true;
        else result.onGround=true;
        result.collision=true;
      }
      const mx=dx/steps,mz=dz/steps,x=actor.x+mx,z=actor.z+mz;
      if(canOccupy(x,z,radius,height,testY)){actor.x=x;actor.z=z;}
      else{
        result.collision=true;
        if(canOccupy(x,actor.z,radius,height,testY))actor.x=x;
        if(canOccupy(actor.x,z,radius,height,testY))actor.z=z;
      }
      actor.y=testY;
      if(actor.y<=EPS){actor.y=0;result.onGround=true;}
    }
    actor.onGround=result.onGround;
    return result;
  }
  function raycast(from,direction,maxDistance=100,{vision=false}={}){
    const length=Math.hypot(direction.x,direction.y||0,direction.z);
    if(length<EPS||maxDistance<=0)return null;
    position.set(from.x,from.y??1.4,from.z);
    rayDir.set(direction.x/length,(direction.y||0)/length,direction.z/length);
    ray.set(position,rayDir);
    const candidates=[];
    octree.getRayTriangles(ray,candidates);
    let nearest=maxDistance,triangle=null,point=null;
    for(const t of candidates){
      const hit=ray.intersectTriangle(t.a,t.b,t.c,false,hitPoint);
      if(!hit)continue;
      const d=position.distanceTo(hit);
      if(d>=.005&&d<nearest){nearest=d;triangle=t;point=hit.clone();}
    }
    if(!triangle)return null;
    triangle.getNormal(normal);
    return {distance:nearest,point:{x:point.x,y:point.y,z:point.z},
      normal:{x:normal.x,y:normal.y,z:normal.z},id:'hissrum12-glb',material:'model'};
  }
  function segmentClear(a,b,options={}){
    const dx=b.x-a.x,dy=(b.y??1)-(a.y??1),dz=b.z-a.z,length=Math.hypot(dx,dy,dz);
    return length<EPS||!raycast({x:a.x,y:a.y??1,z:a.z},{x:dx,y:dy,z:dz},Math.max(0,length-.045),options);
  }
  const world={model,bounds,landmarks,octree,floor,inside,canOccupy,canTravel,move,raycast,segmentClear,
    canStand:(actor,h)=>canOccupy(actor.x,actor.z,actor.radius||.2,h,actor.y||0),
    materialAt:()=> 'concrete',roomAt:(x,z)=>({id:x<bounds.min.x+(bounds.max.x-bounds.min.x)/3?'I01':
      x>bounds.max.x-(bounds.max.x-bounds.min.x)/3?'I26':'I12',name:'Hissrum 12'}),
    doors:null,tactical:null,statistics:stats};
  progress('Bygger säkra gångvägar mellan de verkliga objekten…');
  world.navigation=createNavigation(world,{spacing:1.45});
  world.findPath=world.navigation.findPath;
  const heroTarget=landmarks.find(x=>/CREFORM-vagn 900/i.test(x.name))
    || landmarks.find(x=>/CREFORM/i.test(x.name))
    || {x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2};
  world.anchors=selectAnchors(world.navigation,bounds,heroTarget);
  stats.landmarks=landmarks.length;
  stats.heroTarget=heroTarget.name||'room center';
  stats.playerSpawn={...world.anchors.analysts[0]};
  // A regression assertion against the original bug: the player's physical
  // floor cannot sit above their camera or we would render from below the room.
  if(Math.abs(model.position.y)>MINIATURE_SCALE*.05 || !canOccupy(world.anchors.analysts[0].x,world.anchors.analysts[0].z,.2,1.7,0))
    throw Error('Hissrum FPS spawn is not on the actual room floor');
  console.info('[Hissrum Strike] World validated',JSON.stringify(stats));
  stats.navigation=world.navigation.statistics;
  stats.spawns=10;
  return world;
}
