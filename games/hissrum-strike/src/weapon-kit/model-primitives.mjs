import {buildBazookaParts} from './action-models.mjs';
// Original Cartridge Strike models. No Valve art or downloaded character assets.
// All dimensions are metres; cosmetic meshes never participate in gameplay RNG,
// collision, aim, ammunition or timers. Three.js r180 provides bevels and merging.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { WEAPONS } from './config.mjs';
import { makeBagCartridges } from './cartridge-v11.mjs';

const Y = new THREE.Vector3(0, 1, 0);
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const pulse = (t, from, peak, end) => t < peak ? smooth((t - from) / (peak - from)) : 1 - smooth((t - peak) / (end - peak));
const SKIN = [0xb88b70, 0xd1a688, 0x87634f, 0xc59577, 0x755545];

function material(color, roughness = .72, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
function group(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent?.add(g); return g;
}
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z);
  m.castShadow = !mat.transparent; m.receiveShadow = true; parent.add(m); return m;
}
function bevel(parent, x, y, z, w, h, d, mat, radius = .007) {
  return mesh(parent, new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 2, h / 2, d / 2)), mat, x, y, z);
}
function ellipsoid(parent, x, y, z, w, h, d, mat, segments = 16) {
  const g = new THREE.SphereGeometry(1, segments, 10); g.scale(w, h, d); return mesh(parent, g, mat, x, y, z);
}
function cylinder(parent, a, b, r1, r2, mat, sides = 12) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const m = mesh(parent, new THREE.CylinderGeometry(r2, r1, delta.length(), sides), mat);
  m.position.copy(start.add(end).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(Y, delta.normalize()); return m;
}
function capsule(parent, a, b, radius, mat, flatten = 1) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
  const geo = new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 3, 10);
  geo.scale(1, 1, flatten); const m = mesh(parent, geo, mat);
  m.position.copy(av.add(bv).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(Y, delta.normalize()); return m;
}
function profile(parent, points, width, mat, radius = .003) {
  const s = new THREE.Shape(); points.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y)); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: radius > 0, bevelThickness: radius, bevelSize: radius, bevelSegments: 1, steps: 1, curveSegments: 6 });
  geo.rotateY(Math.PI / 2); geo.translate(-width / 2, 0, 0); return mesh(parent, geo, mat);
}
function tube(parent, points, radius, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return mesh(parent, new THREE.TubeGeometry(curve, points.length * 3, radius, 6, closed), mat);
}

// Consolidate a rigid part by material; joints, magazines and slides stay as
// separate Groups. Geometry transformations are baked once, never per frame.
function consolidate(part) {
  const groups = new Map();
  for (const child of [...part.children]) {
    if (!child.isMesh || child.userData.keepSeparate) continue;
    child.updateMatrix(); let geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geo.applyMatrix4(child.matrix); for (const key of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geo.deleteAttribute(key);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!groups.has(child.material)) groups.set(child.material, []); groups.get(child.material).push(geo);
    child.geometry.dispose(); part.remove(child);
  }
  for (const [mat, geometries] of groups) {
    const merged = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
    if (merged) {
      merged.computeBoundingSphere();
      // Geometry is baked into this identity leaf. Its parent Groups animate;
      // world matrices remain live so every joint and weapon pose still applies.
      const rigid = mesh(part, merged, mat);
      rigid.updateMatrix(); rigid.matrixAutoUpdate = false;
    }
  }
  return part;
}
function consolidateRigidTree(root) {
  // Gloves and the bag have no internal joints. Bake their nested parts into
  // the same rigid local frame and share identical plain material responses.
  root.updateMatrixWorld(true); const inverse = root.matrixWorld.clone().invert(), flat = [], canonical = new Map();
  root.traverse(child => {
    if (!child.isMesh) return;
    const mat = child.material, key = [mat.type, mat.color?.getHex(), mat.roughness, mat.metalness, mat.opacity, mat.transparent, mat.side, mat.map?.uuid, mat.bumpMap?.uuid].join(':');
    let shared = canonical.get(key); if (!shared) { shared = mat; canonical.set(key, shared); }
    const geo = child.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
    flat.push({ geo, mat: shared }); child.geometry.dispose();
  });
  root.clear(); for (const { geo, mat } of flat) mesh(root, geo, mat); return consolidate(root);
}
function texture(draw, width = 256, height = 128) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height); const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function label(parent, text, x, y, z, w, h, { background = '#e0ddd0', foreground = '#23343b', yaw = 0, font = '700', padding = 8 } = {}) {
  const map = texture((c, width, height) => {
    c.fillStyle = background; c.fillRect(0, 0, width, height); c.fillStyle = foreground;
    c.textAlign = 'center'; c.textBaseline = 'middle'; const rows = text.split('\n');
    c.font = `${font} ${Math.min(height / (rows.length + .55), (width - padding * 2) / Math.max(...rows.map(t => t.length)) * 1.5)}px Arial,sans-serif`;
    rows.forEach((row, i) => c.fillText(row, width / 2, (i + .5) * height / rows.length));
  }, 256, 96);
  const m = mesh(parent, new THREE.PlaneGeometry(w, h), material(0xffffff, .87, 0, { map, side: THREE.DoubleSide }), x, y, z);
  m.rotation.y = yaw; return m;
}
let sharedFabricTexture;
function fabricMap() {
  if(sharedFabricTexture)return sharedFabricTexture;
  const data = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4; const v = ((x + y) % 3 === 0 ? 160 : 206) + ((x * 13 + y * 7) % 17);
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  const map = new THREE.DataTexture(data, 32, 32); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 4); map.needsUpdate = true;sharedFabricTexture=map;return map;
}
function cloth(color) { return material(color, .91, 0, { roughnessMap: fabricMap(), bumpMap: fabricMap(), bumpScale: .00075 }); }

export function cartridge(type = 'he', scale = 1) {
  const root = group(null, `cartridge-${type}`), white = material(0xe6e4d9, .49), seam = material(0xb8bcb2, .6);
  const color = { smoke: 0x568b80, flash: 0xd3b768, he: 0xb06643, bomb: 0xc58845 }[type] || 0x739a9a;
  const lid = material(color, .51), dark = material(0x334649, .49, .2);
  bevel(root, 0, .078, 0, .124, .156, .084, white, .008);
  bevel(root, 0, .011, 0, .13, .019, .09, seam, .004);
  bevel(root, 0, .159, 0, .137, .027, .095, lid, .005);
  // Cartridge's assay chambers and twin port silhouette distinguish it from a
  // conventional spherical grenade; the labels are fictional game equipment.
  for (const x of [-.038, .038]) {
    cylinder(root, [x, .174, 0], [x, .204, 0], .012, .012, white);
    cylinder(root, [x, .203, 0], [x, .210, 0], .015, .015, lid);
  }
  for (const x of [-.047, .047]) bevel(root, x, .075, -.044, .010, .119, .009, seam, .003);
  label(root, type === 'smoke' ? 'SMOKE\nCARTRIDGE' : type === 'flash' ? 'FLASH\nCARTRIDGE' : type === 'he' ? 'HE\nCARTRIDGE' : 'C05\nOBJECTIVE', 0, .083, -.043, .098, .073, { yaw: Math.PI });
  bevel(root, .043, .133, -.047, .015, .01, .005, dark, .001);
  consolidate(root); root.scale.setScalar(scale); root.userData.type = type; return root;
}

function makeBag() {
  const bag = group(null, 'Cepheid-cartridge-bag');
  const film = new THREE.MeshPhysicalMaterial({ color: 0xe6efed, roughness: .36, metalness: 0, transparent: true, opacity: .23, side: THREE.DoubleSide, depthWrite: false });
  const seams = material(0xc8d9d5, .46, 0, { transparent: true, opacity: .62, depthWrite: false });
  const w = .245, h = .27, d = .13;
  // A crinkled sewn envelope, not a transparent box. Front/back film and side
  // gussets remain one mesh and are intentionally non-transmissive for cost.
  const geo = new THREE.BoxGeometry(w, h, d, 10, 10, 3), position = geo.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const fold = Math.sin(x * 98 + y * 41) * Math.sin(y * 67 - x * 21) * .005;
    position.setXYZ(i, x * (1 - .14 * ((y / h) + .5)), y, z + Math.sign(z || 1) * fold);
  }
  geo.computeVertexNormals(); mesh(bag, geo, film);
  for (const side of [-1, 1]) {
    tube(bag, [[-.09, .13, side * .048], [-.067, .20, side * .042], [0, .219, side * .04], [.067, .20, side * .042], [.09, .13, side * .048]], .007, seams);
    tube(bag, [[-.118, -.13, side * .063], [0, -.137, side * .067], [.118, -.13, side * .063]], .0024, seams);
    for (let i = 0; i < 4; i++) tube(bag, [[-.1 + i * .065, .12, side * .055], [-.08 + i * .058, .04, side * .069], [-.1 + i * .065, -.10, side * .065]], .0011, seams);
  }
  label(bag, 'Cepheid\ncartridges', 0, .045, -.071, .18, .065, { yaw: Math.PI, background: '#e5ece8', foreground: '#244955' });
  // Consolidate only the film/seams. Cartridge templates are shared by all bags
  // and must never be baked/disposed as per-actor private geometry.
  consolidateRigidTree(bag);bag.add(makeBagCartridges());return bag;
}

function glove(parent, x, y, z, side, palmMat, rubber, cuffMat, { view = false } = {}) {
  const g = group(parent, side > 0 ? 'right-glove' : 'left-glove', x, y, z);
  ellipsoid(g, 0, 0, 0, .034, .044, .024, palmMat);
  bevel(g, 0, -.007, .021, .050, .049, .012, rubber, .005);
  for (let i = 0; i < 4; i++) {
    const fy = .027 - i * .016;
    tube(g, [[side * .018, fy, -.012], [side * .034, fy, -.027], [side * .018, fy, -.040], [-side * .008, fy, -.035]], .0072, palmMat);
    ellipsoid(g, side * .027, fy, -.023, .009, .009, .010, rubber, 8);
  }
  capsule(g, [-side * .022, .026, .002], [-side * .038, -.003, -.021], .012, palmMat);
  bevel(g, 0, -.047, .003, .059, .024, .050, cuffMat, .005);
  if (view) { bevel(g, 0, -.047, .030, .035, .013, .005, rubber, .002); }
  return consolidate(g);
}

// A compact, asymmetric two-hand pose for the first-person P9 only. Three
// fingers close around the grip; index and thumb are articulated separately.
function p9Glove(parent,x,y,z,side,palmMat,rubber,cuffMat){
  const g=group(parent,side>0?'p9-trigger-hand':'p9-support-hand',x,y,z),support=side<0;
  ellipsoid(g,side*.006,-.006,.002,.027,.038,.020,palmMat,14);
  for(let i=0;i<3;i++){
    const fy=(support?-.004:.008)-i*.016;
    tube(g,[[side*.020,fy,-.003],[side*.013,fy,-.027],[-side*.011,fy,-.040],[-side*.031,fy,-.026]],.0061,palmMat);
    ellipsoid(g,side*.014,fy,-.022,.007,.007,.008,rubber,8);
  }
  if(support){
    tube(g,[[-.019,.024,-.005],[-.018,.030,-.028],[.001,.025,-.047],[.018,.017,-.040]],.0062,palmMat);
    capsule(g,[.010,.029,.004],[.018,.038,-.027],.0085,palmMat);
    capsule(g,[.018,.038,-.027],[.012,.034,-.056],.0075,palmMat);
  }else{
    tube(g,[[.019,.026,-.003],[.019,.036,-.035],[.010,.032,-.061],[-.001,.019,-.061]],.0062,palmMat);
    capsule(g,[-.010,.027,.009],[-.029,.032,-.011],.009,palmMat);
    capsule(g,[-.029,.032,-.011],[-.026,.024,-.040],.008,palmMat);
  }
  // Thin sewn reinforcement follows the palm; no large rectangular hand plate.
  ellipsoid(g,side*.010,-.009,.021,.013,.018,.0015,rubber,12);
  bevel(g,0,-.044,.005,.046,.018,.039,cuffMat,.004);
  bevel(g,side*.015,-.044,.024,.017,.010,.003,rubber,.001);
  return consolidate(g);
}

function sleeve(parent, a, b, clothMat, cuffMat, radius=.055) {
  const m = capsule(parent, a, b, radius, clothMat, .92);
  const end = new THREE.Vector3(...b), start = new THREE.Vector3(...a), delta = end.clone().sub(start).normalize();
  const scale=radius/.055;
  cylinder(parent, end.clone().addScaledVector(delta, -.022).toArray(), end.toArray(), .046*scale, .044*scale, cuffMat);
  return m;
}

let sharedMachiningTexture;
function machiningMap() {
  if(sharedMachiningTexture)return sharedMachiningTexture;
  const data=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const at=(y*64+x)*4,grain=((x*17+y*31)%19),scratch=y%17===0&&x%23<12?30:0;
    const value=211+grain-scratch;data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;
  }
  const map=new THREE.DataTexture(data,64,64);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(8,8);map.needsUpdate=true;
  sharedMachiningTexture=map;return map;
}
function weaponPalette() {
  return { steel: material(0x44515a, .42, .82, {roughnessMap:machiningMap(),bumpMap:machiningMap(),bumpScale:.00008}), edge: material(0x7b8588, .35, .88, {roughnessMap:machiningMap()}), black: material(0x192227, .49, .1), polymer: material(0x2c3438, .77, .02), dark: material(0x10171a, .61), wood: material(0x76503a, .49), tan: material(0x82735c, .72), brass: material(0xa9843a, .32, .75), lens: material(0x22464b, .12, .7), paint: material(0xbcc2b7, .5), red: material(0xad4d37, .6) };
}
function rail(parent, z0, z1, y, p, width = .047) {
  bevel(parent, 0, y, (z0 + z1) / 2, width, .012, Math.abs(z1 - z0), p.black, .002);
  const count = Math.max(1, Math.floor(Math.abs(z1 - z0) / .022));
  for (let i = 0; i < count; i++) bevel(parent, 0, y + .009, z0 + (z1 - z0) * (i + .5) / count, width + .01, .009, .012, p.steel, .001);
}
function trigger(parent, z, y, p) {
  tube(parent, [[-.015, y, z + .035], [-.021, y - .053, z + .027], [0, y - .063, z - .042], [.021, y - .047, z - .047], [.016, y, z - .048]], .005, p.polymer);
  tube(parent, [[0, y - .003, z - .008], [0, y - .030, z - .016], [0, y - .038, z - .004]], .0045, p.steel);
}
function sight(parent, z, y, p, back = false, height = .024) {
  bevel(parent, 0, y, z, back ? .046 : .020, height, .018, p.black, .002);
  if (back) for (const side of [-1, 1]) bevel(parent, side * .013, y + .004, z + .01, .005, .005, .002, p.paint, .0005);
  else bevel(parent, 0, y + .006, z + .01, .004, .007, .002, p.paint, .0005);
}

function pistol(root, id, p, {refined=false}={}) {
  const heavy = id === 'p12'; const body = group(root, 'receiver'), slide = group(root, 'slide'), mag = group(root, 'magazine', 0, -.084, .014);
  if(refined){
    p.steel.color.setHex(0x52616a);p.steel.roughness=.48;p.steel.metalness=.74;p.polymer.color.setHex(0x303a3e);p.polymer.roughness=.86;
    profile(body,[[.045,.018],[-.19,.018],[-.19,-.014],[-.066,-.019],[-.037,-.033],[-.011,-.037],[.013,-.128],[.055,-.119],[.054,-.031]],.035,p.polymer,.003);
    for(const side of [-1,1])profile(body,[[.000,-.054],[.034,-.048],[.048,-.113],[.018,-.121]],.002,p.black,.001).position.x=side*.019;
  }else{
    profile(body, [[.052, .018], [-.19, .018], [-.19, -.024], [-.07, -.035], [-.01, -.056], [.025, -.143], [.073, -.132]], .040, heavy ? p.tan : p.polymer, .004);
    bevel(body, .001, -.084, .032, .046, .106, .056, p.polymer, .009).rotation.x = -.19;
  }
  // Checkered grip panels, magazine catch and machined slide release.
  for (const side of [-1, 1]) {
    if(!refined)for (let j = 0; j < 8; j++) bevel(body, side * .025, -.046 - j * .011, .029 + j * .0016, .003, .004, .039, p.black, .001);
    bevel(body, side * (refined?.019:.024), -.011, .012, refined?.004:.006, refined?.008:.011, .030, p.steel, .002);
    cylinder(body, [side * (refined?.018:.023), -.037, .018], [side * (refined?.022:.027), -.037, .018], refined?.005:.007, refined?.005:.007, p.black, 10);
  }
  if(refined){
    tube(body,[[0,-.022,-.057],[0,-.044,-.066],[0,-.066,-.052],[0,-.071,-.014],[0,-.052,.000],[0,-.027,-.005]],.0032,p.polymer,true);
    tube(body,[[0,-.024,-.033],[0,-.043,-.039],[0,-.051,-.029]],.0027,p.steel);
  }else trigger(body, -.035, -.023, p);
  cylinder(body, [0, .045, -.015], [0, .045, -.222], .013, .012, p.edge, 14);
  cylinder(body, [0, .045, -.222], [0, .045, -.225], .008, .008, p.dark, 12);
  bevel(slide, 0, .045, refined?-.088:-.082, refined?.041:.047, refined?.043:heavy ? .057 : .050, refined?.225:.238, heavy ? p.edge : p.steel, refined?.004:.006);
  bevel(slide, 0, refined?.069:.072, -.09, refined?.029:.032, refined?.006:.007, refined?.200:.211, p.steel, .002);
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) bevel(slide, side * (refined?.021:.024), .045, (refined?.013:.019) - i * .008, .0025, refined?.028:.034, .003, p.dark, .0007);
  bevel(slide, refined?.0215:.025, .051, -.053, .003, refined?.016:.022, .040, p.dark, .001);
  bevel(slide, refined?.0225:.026, .046, -.054, .003, .008, .032, p.edge, .001);
  if(refined){sight(slide,-.188,.0775,p,false,.011);bevel(slide,0,.0775,.018,.039,.011,.016,p.black,.002);for(const side of [-1,1])bevel(slide,side*.011,.080,.027,.004,.004,.002,p.paint,.0005);}
  else{sight(slide, -.188, .081, p, false, .011); sight(slide, .024, .081, p, true, .011);}
  label(slide, heavy ? 'P12  /  COUNTER' : 'P9  /  ANALYST', refined?-.0215:-.025, .045, -.094, refined?.088:.100, refined?.015:.019, { yaw: -Math.PI / 2, background: heavy ? '#7b8588' : '#44515a', foreground: '#c7ccca' });
  bevel(mag, 0, -.012, .014, .033, .105, .042, p.steel, .003);
  bevel(mag, 0, -.065, .014, .048, .013, .054, p.black, .004);
  consolidate(body); consolidate(slide); consolidate(mag);
  return { slide, magazine: mag, muzzle: new THREE.Vector3(0, .045, -.227), support: refined?new THREE.Vector3(-.035,-.079,.037):new THREE.Vector3(-.038, -.082, -.012), grip: refined?new THREE.Vector3(.016,-.075,.044):new THREE.Vector3(.021, -.080, .046) };
}

function rifle(root, id, p) {
  const body = group(root, 'receiver'), mag = group(root, 'magazine'), bolt = group(root, 'bolt');
  const ak = id === 'ar47', short = id === 'smg', sniper = id === 'sniper', pump = id === 'shotgun';
  const length = short ? .48 : sniper ? .91 : pump ? .82 : .73;
  const receiverEnd = short ? -.21 : -.28;
  profile(body, [[.07, .073], [receiverEnd, .073], [receiverEnd - .018, -.005], [-.09, -.053], [.04, -.038]], short ? .073 : .055, p.steel, .004);
  bevel(body, 0, .063, -.105, short ? .076 : .061, .040, .25, p.black, .005);
  profile(body, [[.044, -.028], [-.024, -.033], [.003, -.173], [.067, -.155]], .047, ak ? p.wood : p.polymer, .006);
  for (let i = 0; i < 7; i++) bevel(body, .025, -.071 - i * .011, .026 + i * .002, .004, .004, .045, p.black, .001);
  trigger(body, -.040, -.036, p);
  cylinder(body, [0, .044, receiverEnd], [0, .044, -length], .015, .013, p.steel, 14);
  cylinder(body, [0, .044, -length], [0, .044, -length - .044], .021, .021, p.black, 14);
  cylinder(body, [0, .044, -length - .045], [0, .044, -length - .046], .010, .010, p.dark, 12);
  for (let i = 0; i < 3; i++) bevel(body, .020, .045, -length - .009 - i * .010, .003, .012, .004, p.dark, .0005);
  if (ak || pump || sniper) {
    profile(body, [[.07, .045], [.33, .008], [.34, -.125], [.28, -.138], [.14, -.035], [.07, -.036]], .049, ak ? p.wood : p.polymer, .008);
    bevel(body, 0, -.064, .335, .065, .143, .018, p.black, .005).rotation.x = .10;
    if (ak) {
      profile(mag, [[-.12, -.030], [-.20, -.038], [-.20, -.105], [-.177, -.202], [-.14, -.260], [-.072, -.244], [-.107, -.165]], .045, p.black, .004);
      for (const side of [-1, 1]) for (let j = 0; j < 3; j++) tube(mag, [[side * .025, -.064, -.178 + j * .020], [side * .025, -.15, -.158 + j * .018], [side * .025, -.227, -.125 + j * .016]], .003, p.steel);
      bevel(body, 0, .020, -.397, .071, .073, .202, p.wood, .008);
      cylinder(body, [0, .091, -.27], [0, .091, -.52], .017, .013, p.black);
      for (let i = 0; i < 4; i++) bevel(body, 0, .054, -.35 - i * .03, .073, .005, .007, p.black, .001);
      sight(body, -.65, .086, p); sight(body, -.22, .11, p, true);
    }
    if (pump) {
      cylinder(body, [0, .003, -.24], [0, .003, -.716], .018, .018, p.black, 12);
      const forearm = group(root, 'pump', 0, 0, 0);
      bevel(forearm, 0, -.005, -.405, .076, .080, .182, p.wood, .012);
      for (let i = 0; i < 9; i++) bevel(forearm, 0, -.005, -.326 - i * .019, .080, .084, .004, p.black, .001);
      root.userData.pump = consolidate(forearm);
      bevel(body, 0, -.035, -.14, .043, .014, .095, p.dark, .004);
      cylinder(mag, [0, -.047, -.125], [0, -.047, -.185], .012, .012, p.red);
      cylinder(mag, [0, -.047, -.125], [0, -.047, -.139], .013, .013, p.brass);
      sight(body, -.77, .067, p);
    }
    if (sniper) {
      bevel(body, 0, .004, -.364, .064, .074, .212, p.polymer, .01);
      bevel(mag, 0, -.067, -.165, .047, .071, .100, p.black, .004);
      cylinder(body, [0, .165, -.08], [0, .165, -.35], .029, .033, p.black, 18);
      cylinder(body, [0, .165, -.35], [0, .165, -.423], .037, .046, p.steel, 18);
      cylinder(body, [0, .165, -.424], [0, .165, -.425], .039, .039, p.lens, 20);
      cylinder(body, [0, .165, -.079], [0, .165, -.057], .034, .034, p.black, 18);
      cylinder(body, [0, .165, -.056], [0, .165, -.055], .026, .026, p.lens, 20);
      for (const z of [-.12, -.29]) { bevel(body, 0, .105, z, .041, .055, .025, p.steel, .003); cylinder(body, [0, .134, z], [0, .192, z], .037, .037, p.black, 12); }
      cylinder(body, [0, .181, -.22], [0, .224, -.22], .023, .023, p.steel);
      cylinder(body, [.025, .165, -.22], [.058, .165, -.22], .021, .021, p.steel);
      tube(bolt, [[.028, .046, .018], [.069, .036, .018], [.080, .001, .025]], .007, p.edge);
      ellipsoid(bolt, .081, -.004, .028, .018, .019, .018, p.black);
    }
  } else {
    cylinder(body, [0, .024, .066], [0, .024, .265], .023, .023, p.black);
    profile(body, [[.155, .037], [.31, .033], [.31, -.129], [.267, -.139], [.19, -.058], [.15, -.047]], .061, p.polymer, .006);
    bevel(body, 0, -.05, .315, .071, .174, .018, p.black, .005);
    if (short) {
      bevel(body, 0, -.043, -.201, .073, .119, .098, p.polymer, .009);
      profile(mag, [[-.164, -.092], [-.213, -.092], [-.19, -.267], [-.14, -.267]], .042, p.black, .003);
      bevel(body, 0, .016, -.32, .066, .065, .159, p.polymer, .007);
      for (let i = 0; i < 5; i++) bevel(body, .034, .025, -.265 - i * .027, .004, .021, .012, p.dark, .002);
    } else {
      profile(mag, [[-.11, -.031], [-.18, -.032], [-.173, -.19], [-.10, -.208]], .044, p.steel, .003);
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) bevel(mag, side * .024, -.119, -.122 - i * .018, .0025, .136, .004, p.black, .001).rotation.x = -.10;
      bevel(body, 0, .036, -.413, .070, .073, .281, p.polymer, .006);
      for (const side of [-1, 1]) for (let j = 0; j < 7; j++) bevel(body, side * .036, .028, -.30 - j * .033, .003, .025, .020, p.dark, .003);
      rail(body, -.27, -.55, .08, p);
    }
    rail(body, .022, short ? -.37 : -.25, .10, p);
    sight(body, short ? -.39 : -.61, .116, p); sight(body, .02, .129, p, true);
  }
  if (!sniper) {
    bevel(bolt, .030, .054, -.09, .011, .024, .085, p.edge, .003);
    cylinder(bolt, [.028, .035, -.071], [.063, .035, -.071], .006, .007, p.black);
  }
  for (const z of [-.20, -.025]) cylinder(body, [.028, -.009, z], [.032, -.009, z], .006, .006, p.edge, 8);
  label(body, id.toUpperCase(), -.031, .015, -.12, .105, .021, { yaw: -Math.PI / 2, background: '#44515a', foreground: '#bfc6c5' });
  consolidate(body); consolidate(mag); consolidate(bolt);
  return { magazine: mag, slide: bolt, muzzle: new THREE.Vector3(0, .044, -length - .047), support: new THREE.Vector3(-.018, -.028, short ? -.29 : -.385), grip: new THREE.Vector3(.023, -.106, .033) };
}

function knife(root, p) {
  const body = group(root, 'knife');
  profile(body, [[-.045, .019], [-.34, .019], [-.40, -.012], [-.33, -.043], [-.045, -.025]], .008, p.edge, .001);
  profile(body, [[-.048, .02], [-.34, .02], [-.399, -.012], [-.31, -.004], [-.048, -.003]], .009, p.steel, .0005);
  bevel(body, 0, -.006, .035, .040, .049, .165, p.polymer, .009);
  for (let i = 0; i < 8; i++) bevel(body, 0, -.006, -.023 + i * .017, .044, .053, .003, p.black, .0005);
  bevel(body, 0, -.005, -.053, .097, .077, .015, p.steel, .003);
  cylinder(body, [0, -.006, .116], [0, -.006, .124], .024, .024, p.steel);
  consolidate(body); return { grip: new THREE.Vector3(.01, -.026, .032), support: new THREE.Vector3(-.22, -.04, -.02), muzzle: new THREE.Vector3(0, 0, -.4) };
}

function bomb(root, p) {
  const body = group(root, 'cartridge-objective');
  bevel(body, 0, .015, 0, .31, .056, .20, p.polymer, .009);
  for (const x of [-.098, 0, .098]) { const c = cartridge('bomb', .72); c.rotation.x = -Math.PI / 2; c.position.set(x, .056, .074); body.add(c); }
  bevel(body, .078, .081, .018, .10, .033, .10, p.black, .004);
  label(body, 'C05\nARMED', .078, .100, .02, .084, .052, { background: '#133b30', foreground: '#9cc498' }).rotation.x = -Math.PI / 2;
  tube(body, [[-.1, .085, -.04], [-.16, .12, -.03], [-.14, .13, .08], [.035, .12, .06]], .004, p.red);
  consolidate(body); return { grip: new THREE.Vector3(.12, -.019, .034), support: new THREE.Vector3(-.12, -.019, .034), muzzle: new THREE.Vector3() };
}

function buildWeapon(id = 'p9', { viewmodel = true } = {}) {
  const root = group(null, `weapon-${id}`), weapon = group(root, 'weapon'), p = weaponPalette();
  const refinedP9=id==='p9'&&viewmodel;
  let parts;
  if (['smoke', 'flash', 'he'].includes(id)) {
    const c = cartridge(id, .95); c.rotation.x = -.18; weapon.add(c);
    parts = { grip: new THREE.Vector3(.034, .059, .014), support: new THREE.Vector3(-.17, -.015, -.02), muzzle: new THREE.Vector3(0, .2, 0) };
  } else if (id === 'bomb') parts = bomb(weapon, p);
  else if (id === 'bazooka') parts = buildBazookaParts(weapon);
  else if (id === 'knife') parts = knife(weapon, p);
  else if (['p9', 'p12'].includes(id)) parts = pistol(weapon, id, p,{refined:refinedP9});
  else parts = rifle(weapon, id, p);
  const arms = group(root, 'viewmodel-arms'); arms.visible = viewmodel;
  let leftHand, rightHand;
  if (viewmodel) {
    const fabric = cloth(0x364b59), cuff = material(0x26353d, .86), gloveMat = material(0x4e554e, .83), rubber = material(refinedP9 ? 0x414a43 : 0x202b2d, refinedP9 ? .86 : .72);
    const right = parts.grip, left = parts.support;
    const rightArm = group(arms, 'right-forearm');
    sleeve(rightArm, [right.x + .16, -.37, .29], [right.x + .012, right.y - .05, right.z + .038], fabric, cuff,refinedP9?.040:.055);
    // Forearm seam and a small wrist strap add shape without a large block hand.
    tube(rightArm, [[right.x + .17, -.36, .28], [right.x + .09, -.23, .17], [right.x + .035, right.y - .08, right.z + .05]], .002, cuff);
    rightHand = refinedP9?p9Glove(rightArm,right.x,right.y,right.z,1,gloveMat,rubber,cuff):glove(rightArm, right.x, right.y, right.z, 1, gloveMat, rubber, cuff, { view: true });
    rightHand.rotation.x = -.16; consolidate(rightArm);
    leftHand = group(arms, 'left-hand-and-forearm', left.x, left.y, left.z);
    const primary = WEAPONS[id]?.slot === 'primary';
    sleeve(leftHand, [-.22 - left.x, -.38 - left.y, .24 - left.z], [-.018, -.055, .025], fabric, cuff,refinedP9?.040:.055);
    (refinedP9?p9Glove(leftHand,0,0,0,-1,gloveMat,rubber,cuff):glove(leftHand, 0, 0, 0, -1, gloveMat, rubber, cuff, { view: true })).rotation.z = primary ? -.35 : -.12;
    consolidate(leftHand); leftHand.userData.home = leftHand.position.clone();
  }
  let magazineGrip;
  if (parts.magazine) {
    // Store the actual magazine/shell centre in its own coordinates. Reload
    // fingers follow this moving part instead of a hand-authored downward sway.
    root.updateMatrixWorld(true);
    magazineGrip = parts.magazine.worldToLocal(new THREE.Box3().setFromObject(parts.magazine).getCenter(new THREE.Vector3()));
  }
  root.userData = { ...root.userData, ...parts, id, weapon, arms, leftHand, rightHand, viewmodel, ...(refinedP9?{visualVariant:'p9-firstperson-refined'}:{}), pump: weapon.userData.pump,
    magazineHome: parts.magazine?.position.clone(), magazineGrip, reloadGrip: new THREE.Vector3(), slideHome: parts.slide?.position.clone(), authored: 'Cartridge Strike original geometry' };
  return root;
}


// Bare world weapons recur across bots and drops. Build their immutable mesh
// resources once, while every actor keeps its own animated transform hierarchy.
const worldWeaponTemplates = new Map();
function markSharedWeaponResources(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.userData.sharedWeapon = true;
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      mat.userData.sharedWeapon = true;
      for (const value of Object.values(mat)) if (value?.isTexture) value.userData.sharedWeapon = true;
    }
  });
}
function instantiateWorldWeapon(template) {
  const nodes = new Map();
  function node(source) {
    // Object3D.copy/clone JSON-serializes userData. Weapon metadata contains
    // child-object pointers (pump, slide, magazine), so copy transforms directly.
    const copy = source.isMesh ? new THREE.Mesh(source.geometry, source.material) : source.isGroup ? new THREE.Group() : new THREE.Object3D();
    nodes.set(source, copy); copy.name = source.name;
    copy.position.copy(source.position); copy.rotation.order = source.rotation.order;
    copy.quaternion.copy(source.quaternion); copy.scale.copy(source.scale);
    copy.matrix.copy(source.matrix); copy.matrixWorld.copy(source.matrixWorld);
    copy.matrixAutoUpdate = source.matrixAutoUpdate; copy.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
    copy.visible = source.visible; copy.castShadow = source.castShadow; copy.receiveShadow = source.receiveShadow;
    copy.frustumCulled = source.frustumCulled; copy.renderOrder = source.renderOrder; copy.layers.mask = source.layers.mask;
    for (const child of source.children) copy.add(node(child));
    return copy;
  }
  const root = node(template), memo = new Map();
  function metadata(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value.isObject3D) {
      const copy = nodes.get(value); if (!copy) throw new Error('Weapon metadata points outside its own template');
      return copy;
    }
    if (memo.has(value)) return memo.get(value);
    if (value.isVector2 || value.isVector3 || value.isVector4 || value.isEuler || value.isQuaternion || value.isMatrix3 || value.isMatrix4 || value.isColor) {
      const copy = value.clone(); memo.set(value, copy); return copy;
    }
    const copy = Array.isArray(value) ? [] : {};
    memo.set(value, copy); for (const [key, entry] of Object.entries(value)) copy[key] = metadata(entry);
    return copy;
  }
  for (const [source, copy] of nodes) copy.userData = metadata(source.userData);
  root.userData.sharedWeaponInstance = true;
  return root;
}
export function makeWeapon(id = 'p9', { viewmodel = true } = {}) {
  if (viewmodel) return buildWeapon(id, { viewmodel });
  let template = worldWeaponTemplates.get(id);
  if (!template) {
    template = buildWeapon(id, { viewmodel: false }); markSharedWeaponResources(template);
    worldWeaponTemplates.set(id, template);
  }
  return instantiateWorldWeapon(template);
}
/** Final renderer teardown only. Removing a drop or restarting a round must
 * retain these shared resources for the surviving actors and later rounds. */
export function disposeWeaponResources() {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  for (const template of worldWeaponTemplates.values()) template.traverse(object => {
    if (!object.isMesh) return; geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  if (textures.has(sharedMachiningTexture)) sharedMachiningTexture = null;
  worldWeaponTemplates.clear();
}

function torsoGeometry(mat, parent) {
  // Tailored, tapered cross-sections give the chest shoulders and a waist.
  const levels = [[0, .132, .082], [.10, .145, .091], [.27, .160, .104], [.40, .152, .099], [.47, .100, .075]];
  const pos = [], uv = [], indices = [], n = 16;
  for (let row = 0; row < levels.length; row++) for (let i = 0; i <= n; i++) {
    const [y, rx, rz] = levels[row], a = i / n * Math.PI * 2;
    pos.push(Math.cos(a) * rx, y, Math.sin(a) * rz); uv.push(i / n, row / (levels.length - 1));
  }
  for (let row = 0; row < levels.length - 1; row++) for (let i = 0; i < n; i++) { const a = row * (n + 1) + i; indices.push(a, a + n + 2, a + 1, a, a + n + 1, a + n + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  mesh(parent, geo, mat);
}

export function makeActor(team, id, isHostage = false) {
  const root = group(null, `actor-${id}`), seed = [...String(id)].reduce((n, c) => n * 31 + c.charCodeAt(0) >>> 0, 1);
  const analyst = team === 'analysts', color = isHostage ? 0xd2d6c9 : analyst ? 0x365c74 : 0x8c795b;
  const fabric = cloth(color), trousers = cloth(isHostage ? 0x424e58 : analyst ? 0x293a48 : 0x4e5043);
  const armor = material(isHostage ? 0x788d80 : analyst ? 0x243e4d : 0x555245, .86), strap = material(0x303a36, .89), boots = material(0x20282a, .76), sole = material(0x141b1e, .94);
  const skin = material(SKIN[seed % SKIN.length], .87), hair = material(seed % 2 ? 0x302821 : 0x50483e, .96), metal = material(0x6f7b7b, .43, .7), glass = material(0x254a54, .18, .35);
  const torso = group(root, 'torso-rig', 0, .86, 0), chest = group(torso, 'jacket');
  torsoGeometry(fabric, chest);
  bevel(chest, 0, .016, 0, .28, .092, .185, trousers, .025);
  cylinder(chest, [0, .431, 0], [0, .557, 0], .059, .053, skin);
  cylinder(chest, [0, .468, 0], [0, .508, 0], .072, .065, fabric);
  for (const side of [-1, 1]) {
    bevel(chest, side * .058, .418, -.062, .074, .069, .024, fabric, .008).rotation.z = side * .32;
    bevel(chest, side * .07, .238, -.109, .100, .115, .032, armor, .010);
    bevel(chest, side * .07, .279, -.129, .105, .026, .012, fabric, .004);
    tube(chest, [[side * .13, .065, -.02], [side * .152, .19, -.04], [side * .134, .33, -.065]], .0023, strap);
  }
  bevel(chest, 0, .225, -.107, .007, .37, .008, metal, .001);
  bevel(chest, 0, .045, -.098, .045, .037, .012, metal, .003);
  if (!isHostage) {
    for (const side of [-1, 1]) {
      bevel(chest, side * .115, .30, -.097, .032, .254, .018, strap, .005).rotation.z = side * .10;
      bevel(chest, side * .102, .100, -.116, .07, .10, .033, armor, .007);
    }
    bevel(chest, 0, .22, .092, .225, .27, .043, armor, .012);
    label(chest, analyst ? 'ANALYSTS' : 'COUNTER\nANALYSTS', 0, .25, .117, .184, .093, { background: analyst ? '#243e4d' : '#555245', foreground: '#d7ddd5' });
    label(chest, analyst ? 'A  /  05' : 'CA  /  05', 0, .352, -.116, .154, .038, { yaw: Math.PI, background: analyst ? '#243e4d' : '#555245', foreground: '#e1e4d7' });
  } else {
    // A visibly different civilian lab coat and ID badge, without real data.
    bevel(chest, -.072, .20, -.121, .055, .081, .005, material(0xdde7e1, .8), .002);
    label(chest, 'VISITOR\n05', -.071, .20, -.125, .050, .060, { yaw: Math.PI, background: '#dde7e1', foreground: '#416057' });
  }
  if(!isHostage){
    // Radio, webbing and a flex lead share the existing rigid material batches.
    bevel(chest,-.102,.356,-.114,.045,.082,.029,strap,.005);
    cylinder(chest,[-.113,.397,-.11],[-.119,.445,-.105],.003,.0025,strap,6);
    for(let i=0;i<3;i++)bevel(chest,-.102,.35+i*.009,-.130,.028,.003,.002,metal,.0005);
    tube(chest,[[-.094,.392,-.12],[-.062,.415,-.13],[-.045,.46,-.08]],.0025,strap);
  }
  consolidate(chest);
  const head = group(torso, 'head', 0, .665, -.005);
  ellipsoid(head, 0, 0, 0, .096, .127, .090, skin, 20);
  ellipsoid(head, 0, -.061, -.025, .073, .065, .073, skin);
  for (const side of [-1, 1]) {
    ellipsoid(head, side * .094, -.010, .003, .017, .031, .019, skin, 10);
    ellipsoid(head, side * .037, .012, -.078, .023, .014, .016, material(0xe1d4bd, .8), 10);
    ellipsoid(head, side * .037, .012, -.091, .007, .008, .004, hair, 8);
    capsule(head, [side * .015, .035, -.085], [side * .059, .037, -.073], .006, hair);
  }
  ellipsoid(head, 0, -.018, -.091, .016, .034, .022, skin, 10);
  capsule(head, [-.025, -.060, -.081], [.025, -.060, -.081], .0035, material(0x795349, .85));
  if (isHostage) {
    ellipsoid(head, 0, .079, .014, .099, .064, .088, hair);
  } else {
    const cap = material(analyst ? 0x293f4a : 0x696552, .82);
    ellipsoid(head, 0, .089, .009, .107, .079, .098, cap);
    bevel(head, 0, .061, -.101, .155, .015, .090, cap, .007);
    // Lightweight protective spectacles, not an opaque featureless face block.
    for (const side of [-1, 1]) {
      bevel(head, side * .041, .014, -.094, .060, .031, .013, strap, .008);
      bevel(head, side * .041, .014, -.102, .049, .023, .004, glass, .005);
      tube(head, [[side * .073, .024, -.079], [side * .096, .024, -.015], [side * .093, .01, .023]], .004, strap);
    }
    capsule(head, [-.017, .019, -.10], [.017, .019, -.10], .004, strap);
    cylinder(head, [.102, -.012, .005], [.116, -.012, .005], .028, .028, strap);
    tube(head, [[.113, -.03, 0], [.105, -.075, -.05], [.05, -.076, -.105]], .004, strap);
  }
  consolidate(head);
  const limbs = [], knees = [];
  for (const side of [-1, 1]) {
    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', side * .077, .86, 0);
    capsule(leg, [0, -.015, 0], [0, -.395, .006], .073, trousers, .93);
    bevel(leg, side * .054, -.18, .008, .038, .13, .086, fabric, .008);
    const knee = group(leg, 'knee', 0, -.39, .008);
    capsule(knee, [0, 0, 0], [0, -.371, -.003], .057, trousers, .95);
    ellipsoid(knee, 0, -.025, -.046, .052, .063, .022, armor, 12);
    bevel(knee, 0, -.388, .012, .115, .126, .110, boots, .024);
    ellipsoid(knee, 0, -.426, -.045, .059, .041, .092, boots);
    bevel(knee, 0, -.458, -.031, .125, .025, .199, sole, .007);
    for (let i = 0; i < 4; i++) bevel(knee, 0, -.368 + i * .011, -.105, .073, .004, .004, strap, .001);
    consolidate(leg); consolidate(knee); limbs.push(leg); knees.push(knee);
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', side * .147, .409, -.004);
    const elbow = [side * .005, -.188, -.041], wrist = [-side * .12, -.253, side < 0 ? -.269 : -.14];
    sleeve(arm, [0, -.015, 0], elbow, fabric, strap);
    if(!isHostage){
      const patch=bevel(arm,side*.047,-.073,-.013,.012,.064,.055,armor,.004);patch.rotation.z=-side*.10;
      for(let j=0;j<2;j++)bevel(arm,side*.055,-.069+j*.014,-.013,.003,.004,.036,fabric,.001);
    }
    capsule(arm, elbow, wrist, .045, fabric, .92);
    ellipsoid(arm, elbow[0], elbow[1], elbow[2] + .025, .046, .052, .026, armor, 12);
    glove(arm, wrist[0], wrist[1], wrist[2], side, armor, boots, strap);
    consolidateRigidTree(arm); limbs.push(arm);
  }
  const weaponSocket = group(torso, 'weapon-socket', .026, .267, -.165);
  let bag;
  if (!isHostage) { bag = makeBag(); bag.position.set(.217, -.100, .040); torso.add(bag); }
  const marker = label(root, isHostage ? 'GISSLAN' : analyst ? 'A' : 'CA', 0, 1.84, 0, isHostage ? .29 : .18, .104, { background: isHostage ? '#315345' : analyst ? '#274d67' : '#756044', foreground: '#dce5df' });
  const frame = group(null, 'body-frame');
  for (const child of [...root.children]) if (child !== marker) frame.add(child); root.add(frame);
  root.userData = { limbs, knees, torso, head, weaponSocket, bag, marker, frame, seed: seed % 1000 / 100, speed: 0, walkPhase: 0, crouch: 0, isHostage, weaponId: null, weaponCache: new Map(), authoredHeight: 1.70 };
  return root;
}

function mechanisms(model, actor, time, shotAt) {
  const d = model.userData, spec = WEAPONS[d.id], duration = spec?.reload || 1;
  const reloading = actor.reloadUntil > time, progress = reloading ? clamp(1 - (actor.reloadUntil - time) / duration) : 0;
  const reach = reloading ? pulse(progress, .05, .33, .88) : 0;
  if (d.magazine) {
    d.magazine.position.copy(d.magazineHome);
    const pull = reloading ? pulse(progress, .13, .39, .78) : 0;
    if(d.id==='bazooka'){
      d.magazine.position.z+=pull*.47;d.magazine.position.y-=pull*.06;d.magazine.visible=reloading;
    } else if (d.id === 'shotgun') {
      const cycle = (progress * 4) % 1;
      d.magazine.position.y -= reloading ? Math.sin(cycle * Math.PI) * .14 : 0;
      d.magazine.position.x -= reloading ? Math.sin(cycle * Math.PI) * .06 : 0;
      d.magazine.visible = reloading;
    } else {
      d.magazine.position.y -= pull * .23; d.magazine.position.x -= pull * .055;
      d.magazine.rotation.z = pull * -.25; d.magazine.rotation.x = pull * -.14;
      d.magazine.visible = !(reloading && progress > .43 && progress < .55);
    }
  }
  if (d.leftHand) {
    d.leftHand.position.copy(d.leftHand.userData.home); d.leftHand.rotation.set(0, 0, 0);
    if (reloading && d.magazineGrip) {
      d.magazine.updateMatrix();
      d.reloadGrip.copy(d.magazineGrip).applyMatrix4(d.magazine.matrix);
      d.reloadGrip.x -= .027; d.reloadGrip.z += .014;
      d.leftHand.position.lerp(d.reloadGrip, reach);
      d.leftHand.rotation.x = reach * (d.magazine.rotation.x - .15);
      d.leftHand.rotation.z = reach * (d.magazine.rotation.z - .10);
    }
  }
  const shotAge = time - shotAt, shot = shotAge >= 0 && shotAge < .18 ? Math.exp(-shotAge * 28) : 0;
  if (d.slide) { d.slide.position.copy(d.slideHome); d.slide.position.z += shot * .035; }
  if (d.pump) d.pump.position.z = shotAge >= .08 && shotAge < .55 ? Math.sin((shotAge - .08) / .47 * Math.PI) * .080 : 0;
  return { progress, reloading, reach, shot };
}

export function animateWeapon(model, actor, time, dt, { reducedMotion = false, shotAt = -Infinity, switchAt = -Infinity, throwAt = -Infinity, swingAt = -Infinity, recoil = 0 } = {}) {
  const d = model.userData, { reloading, reach, shot } = mechanisms(model, actor, time, shotAt);
  const speed = clamp((actor.moving || 0) / 4.2), stride = (actor.distanceWalked || time * speed * 3) * 8;
  const bob = reducedMotion ? 0 : Math.sin(stride) * .005 * speed;
  const idle = reducedMotion ? 0 : Math.sin(time * 1.7) * .0013;
  const swap = 1 - smooth((time - switchAt) / .26);
  const throwAge = time - throwAt, throwing = throwAge >= 0 && throwAge < .48 ? Math.sin(throwAge / .48 * Math.PI) : 0;
  const swingAge = time - swingAt, swing = swingAge >= 0 && swingAge < .36 ? Math.sin(swingAge / .36 * Math.PI) : 0;
  const primary = WEAPONS[d.id]?.slot === 'primary';
  model.position.set((primary ? .24 : .17) + (primary ? reach * .015 : 0), (primary ? -.15 : -.11) + bob + idle - swap * .23 - throwing * .26, (primary ? -.53 - reach * .10 : -.47) + shot * .027 + recoil * .35);
  if(d.visualVariant==='p9-firstperson-refined'){model.position.y-=.012;model.position.z-=.035;}
  model.rotation.set(-shot * .065 + reach * (primary ? .12 : -.18) + swap * .48, .14 + reach * (primary ? .23 : -.08), -reach * .33 - swing * .9);
  if (!reducedMotion) { model.position.x += Math.cos(stride * .5) * .004 * speed; model.rotation.z += Math.sin(stride * .5) * .009 * speed; }
  if (reloading) model.position.y += reach * .055;
  if (swing) { model.position.x -= swing * .15; model.position.z -= swing * .15; }
  if (actor.action) { model.position.y -= .12; model.rotation.x -= .25; }
  model.updateMatrixWorld(true);
  return { muzzle: model.localToWorld(d.muzzle.clone()), reloading };
}

export function animateActor(model, actor, time, dt, { cameraYaw = 0, shotAt = -Infinity } = {}) {
  const d = model.userData, speed = Math.min(5, Math.max(0, actor.moving || 0));
  model.scale.set(1, 1, 1); d.frame.rotation.set(0, 0, 0); d.corpse = null; d.marker.visible = true;
  d.speed += (speed - d.speed) * (1 - Math.exp(-dt * 14));
  const moving = clamp(d.speed / 3.15), crouching = actor.crouching || (actor.height && actor.height < 1.3);
  d.crouch += ((crouching ? 1 : 0) - d.crouch) * (1 - Math.exp(-dt * 18));
  const c = d.crouch; d.walkPhase += d.speed * dt * 6.4;
  const gait = Math.sin(d.walkPhase), gaitOther = Math.sin(d.walkPhase + Math.PI);
  d.torso.position.y = .86 - c * .453 + Math.abs(Math.sin(d.walkPhase * 2)) * .009 * moving;
  d.torso.rotation.x = -.74 * c + (actor.onGround === false ? -.06 : 0);
  d.torso.rotation.z = Math.sin(d.walkPhase) * .013 * moving;
  const legs = [d.limbs[0], d.limbs[2]], arms = [d.limbs[1], d.limbs[3]];
  for (let i = 0; i < 2; i++) {
    const wave = i ? gaitOther : gait;
    legs[i].position.y = .86 - c * .453;
    legs[i].rotation.x = -1.15 * c + wave * .48 * moving * (1 - c * .65);
    d.knees[i].rotation.x = 2.3 * c + Math.max(0, -wave) * .60 * moving * (1 - c * .70);
    arms[i].rotation.x = (d.isHostage ? wave * -.26 : wave * .035) * moving;
    arms[i].rotation.z = d.isHostage ? (i ? -.18 : .18) : 0;
  }
  d.head.rotation.y = Math.sin(time * .7 + d.seed) * .024;
  d.head.rotation.x = clamp(actor.pitch || 0, -.45, .45) * .55 + c * .35;
  d.head.rotation.z = 0;
  if (d.bag) { d.bag.position.x = .217; d.bag.rotation.x = Math.sin(d.walkPhase + .7) * moving * .10; d.bag.rotation.z = Math.sin(d.walkPhase + .3) * moving * .07; }
  if (d.marker) { d.marker.position.y = (actor.height || 1.7) + .14; d.marker.rotation.y = cameraYaw - (actor.yaw || 0); }
  if (!d.isHostage) {
    const id = actor.weapon || (actor.team === 'analysts' ? 'p9' : 'p12');
    if (id !== d.weaponId) {
      if (d.weaponModel) d.weaponSocket.remove(d.weaponModel);
      d.weaponModel = d.weaponCache.get(id);
      if (!d.weaponModel) { d.weaponModel = makeWeapon(id, { viewmodel: false }); d.weaponCache.set(id, d.weaponModel); }
      d.weaponModel.scale.setScalar(.85); d.weaponSocket.add(d.weaponModel); d.weaponId = id;
    }
    const state = mechanisms(d.weaponModel, actor, time, shotAt);
    d.weaponSocket.rotation.x = clamp(actor.pitch || 0, -.7, .7) * .75 - state.shot * .06;
    d.weaponSocket.rotation.z = state.reloading ? -state.reach * .25 : 0;
    arms[0].rotation.x -= state.reach * .22;
  }
}

// Bounds in the actor's local horizontal frame, ignoring hidden viewmodel arms,
// the billboard and an ejected/invisible magazine. Used only during a short fall.
function visibleBounds(model) {
  model.updateMatrixWorld(true); const inverse = model.matrixWorld.clone().invert(), box = new THREE.Box3();
  model.traverse(object => {
    if (!object.isMesh || object === model.userData.marker) return;
    for (let p = object; p && p !== model; p = p.parent) if (!p.visible) return;
    object.geometry.computeBoundingBox();
    box.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)));
  }); return box;
}

export function animateCorpse(model, actor, time, { angle = actor.yaw || 0, free = 1.7 } = {}) {
  const age = time - actor.deathAt; if (!Number.isFinite(age) || age < 0 || age > 18) return false;
  const d = model.userData;
  if (!d.corpse || d.corpse.deathAt !== actor.deathAt) {
    const joints = [d.torso, d.head, ...d.limbs, ...d.knees, d.weaponSocket];
    d.corpse = { deathAt: actor.deathAt, joints, original: joints.map(j => ({ position: j.position.clone(), rotation: j.rotation.clone() })), bounds: null };
  }
  const progress = smooth(age / .78), folded = free < 1.5;
  const hips = folded ? .43 : .86;
  const target = d.corpse.joints.map(j => ({ position: j.position.clone(), rotation: new THREE.Euler() }));
  target[0].position.y = hips; target[0].rotation.x = folded ? -.22 : -.035;
  target[1].rotation.x = folded ? .30 : .15; target[1].rotation.z = .10;
  for (const index of [2, 4]) { target[index].position.y = hips; target[index].rotation.x = folded ? 1.05 : index === 2 ? .07 : -.08; }
  for (const index of [3, 5]) { target[index].rotation.x = folded ? -.75 : -.45; target[index].rotation.z = index === 3 ? .13 : -.12; }
  target[6].rotation.x = folded ? -2.10 : .19; target[7].rotation.x = folded ? -2.10 : .26;
  target[8].rotation.x = -1.25; target[8].rotation.z = .06;
  d.corpse.joints.forEach((joint, i) => {
    const original = d.corpse.original[i], to = target[i];
    joint.position.lerpVectors(original.position, to.position, progress);
    joint.rotation.set(original.rotation.x + (to.rotation.x - original.rotation.x) * progress, original.rotation.y + (to.rotation.y - original.rotation.y) * progress, original.rotation.z + (to.rotation.z - original.rotation.z) * progress);
  });
  if (d.bag) { d.bag.position.x = .217 - progress * .10; d.bag.rotation.z = -.22 * progress; }
  d.marker.visible = false; model.scale.set(1, 1, 1);
  model.rotation.set(0, angle, 0); d.frame.rotation.set(1.49 * progress, 0, -.04 * progress);
  model.position.set(actor.x, 0, actor.z);
  // The renderer supplies a collision-checked fall corridor. A compact folded
  // pose handles a short corridor; final fitting applies only to a cosmetic
  // corpse, keeps its whole footprint in that validated space and never moves
  // a live actor, drops, navigation or hitboxes. Floor contact uses the actual
  // posed mesh bounds, rather than burying its feet below the floor.
  const bounds = progress === 1 && d.corpse.bounds ? d.corpse.bounds : visibleBounds(model);
  if (progress === 1) d.corpse.bounds = bounds;
  const spanX = bounds.max.x - bounds.min.x, spanZ = bounds.max.z - bounds.min.z;
  model.scale.x = Math.min(1, .42 / Math.max(.01, spanX));
  model.scale.z = Math.min(1, (Math.max(.2, free) + .24) / Math.max(.01, spanZ));
  const shiftX = -(bounds.min.x + bounds.max.x) * .5 * model.scale.x;
  const shiftZ = clamp(0, -.12 - bounds.min.z * model.scale.z, Math.max(.2, free) + .12 - bounds.max.z * model.scale.z);
  model.position.x += Math.cos(angle) * shiftX + Math.sin(angle) * shiftZ;
  model.position.z += -Math.sin(angle) * shiftX + Math.cos(angle) * shiftZ;
  model.position.y = .006 - bounds.min.y + Math.max(0, actor.y || 0) * (1 - progress);
  return true;
}
