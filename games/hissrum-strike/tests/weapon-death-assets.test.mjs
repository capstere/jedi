import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=resolve(root,'src/weapon-kit');
const get=name=>readFileSync(resolve(src,name),'utf8');

test('exact original Cartridge Strike Quaternius skinned hand mesh data was copied',()=>{
 const data=readFileSync(resolve(src,'authored-hand-data.mjs'));
 const sha=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
 assert.equal(sha,'71ec48f77ed1a357ba254183e03eb369f3433ea8');
 assert.ok(data.length>800000);
 assert.ok(get('strike-kit-hands.mjs').includes('SkinnedMesh'));
 assert.ok(get('strike-kit-models.mjs').includes('poseKitFingers'));
});

test('all source Cartridge Strike first person weapons and animation dependencies exist',()=>{
 for(const name of ['action-models.mjs','cartridge-v11.mjs','config.mjs',
  'model-primitives.mjs','presentation-hands.mjs','presentation-motion.mjs',
  'view-surface.mjs','strike-kit-models.mjs','strike-kit-hands.mjs',
  'strike-kit-timing.mjs','hand-materials.mjs','weapon-view.mjs']){
  assert.ok(existsSync(resolve(src,name)),name);
 }
 const adapter=get('weapon-view.mjs');
 assert.ok(adapter.includes('makeKitWeapon'));
 assert.ok(adapter.includes('fitPresentationHands'));
 assert.ok(adapter.includes('animatePrimitiveWeapon'));
 assert.ok(adapter.includes('animateKitWeapon'));
 assert.ok(adapter.includes('viewMotion'));
 for(const id of ['p9','p12','cr4'])
  assert.ok(get('strike-kit-timing.mjs').includes("'"+id+"'"));
});

test('Death01 is used with authored skeleton, no static placeholder ragdoll',()=>{
 const death=readFileSync(resolve(root,'src/characters/death-animation.mjs'),'utf8');
 assert.ok(death.includes("avatar.clips.get('Death01')"));
 assert.ok(death.includes('LoopOnce'));
 assert.ok(death.includes('clampWhenFinished=true'));
 assert.ok(death.includes('mixer.setTime'));
 assert.ok(death.includes('posedBounds'));
 assert.ok(death.includes('resumeAuthoredAfterRespawn'));
});
