import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const game=path.join(root,'games/hissrum-strike');
const src=path.join(game,'src');
const glb=path.join(root,'Hissrum12_V5_med_39_objekt.glb');

function allModules(folder){
 return readdirSync(folder,{withFileTypes:true}).flatMap(f=>f.isDirectory()?allModules(path.join(folder,f.name)):
 f.name.endsWith('.mjs')?[path.join(folder,f.name)]:[]);
}
test('original Hissrum V5 39-object GLB exists and has glTF 2 binary structure',()=>{
 assert.ok(existsSync(glb),'original model must not be duplicated or renamed');
 const data=readFileSync(glb);
 assert.equal(data.toString('ascii',0,4),'glTF');
 assert.equal(data.readUInt32LE(4),2);
 assert.equal(data.readUInt32LE(8),statSync(glb).size);
 assert.equal(data.toString('ascii',16,20),'JSON');
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 assert.ok(json.scenes?.length>0);
 assert.ok(json.meshes?.length>0);
});
test('every relative ES module import resolves within the spin-off folder',()=>{
 const files=allModules(src);assert.ok(files.length>=10);
 for(const file of files){
  const content=readFileSync(file,'utf8');
  for(const match of content.matchAll(/(?:from\\s*|import\\s*)['"]([^'"]+)['"]/g)){
    if(!match[1].startsWith('.'))continue;
    const target=path.resolve(path.dirname(file),match[1]);
    assert.ok(existsSync(target),path.relative(root,file)+' imports missing '+target);
  }
 }
 assert.ok(existsSync(path.join(game,'index.html')));
 assert.ok(existsSync(path.join(game,'vendor/yuka/yuka.module.js')));
});
