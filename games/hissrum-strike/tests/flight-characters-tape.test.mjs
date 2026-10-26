import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {isDecorativeFloorMarking} from '../src/collision-surfaces.mjs';
import {Game,WEAPONS} from '../src/fps/game.mjs';
const here=resolve(fileURLToPath(import.meta.url),'..','..');
const expected={
  male:'483f795326c96f7649ea41f44ca802c9cc87b8a5',
  female:'df940658096e08872fe2867994fc3ecafa6f8dbb'
};
function glb(gender){
 const bytes=readFileSync(resolve(here,'assets/characters/quaternius-operator-'+gender+'.glb'));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const gitSha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 return {json,gitSha};
}
test('real Cartridge Strike male and female rigged GLBs are vendored exactly',()=>{
 for(const [gender,sha] of Object.entries(expected)){
  const {json,gitSha}=glb(gender);
  assert.equal(gitSha,sha,gender+' was modified during cross-repo transfer');
  assert.ok(json.skins?.length>=1);
  const clips=new Set((json.animations||[]).map(a=>a.name));
  for(const name of ['Idle_Loop','Walk_Loop','Crouch_Idle_Loop','Pistol_Idle_Loop','Pistol_Reload','Death01']){
    assert.ok(clips.has(name),gender+' is missing '+name);
  }
 }
});
test('floor tape is visible decoration, not a collider',()=>{
 const tape={name:'V4_floorTape_black',material:{name:'V4_floorTape_yellow'},
   parent:{name:'Golvtejp_7',parent:{name:'Room'}}};
 assert.equal(isDecorativeFloorMarking(tape),true);
 assert.equal(isDecorativeFloorMarking({name:'triangle',
   material:{name:'V4_floorTape_black'},parent:{name:'room'}}),true);
 assert.equal(isDecorativeFloorMarking({name:'wall__steel',
   material:{name:'steel'},parent:{name:'room'}}),false);
 assert.equal(isDecorativeFloorMarking({name:'EUR-pall',material:{name:'wood'}}),false);
});
test('flight uses vertical movement without gravity and keeps bot grounded rules unchanged',()=>{
 const player={id:'analysts-0',isPlayer:true,flying:true,
   x:0,z:0,y:0,yaw:0,pitch:0,onGround:true,height:1.7,radius:.2,
   vy:0,jumpHeld:false,crouching:false,moving:0,distanceWalked:0,lastStep:0};
 const context={
  config:{standingHeight:1.7,crouchingHeight:1.08,flySpeed:5.8,
    crouchSpeed:1.35,sneakSpeed:1.65,botSpeed:3.15,runSpeed:4.2,gravity:18},
  world:{canStand:()=>true,materialAt:()=> 'concrete'},
  emit:()=>{},random:()=>.5,state:{time:3},
  moveBody:(a,dx,dy,dz)=>{a.x+=dx;a.y=Math.max(0,a.y+dy);a.z+=dz;
    return {collision:false,onGround:a.y===0};}
 };
 Game.prototype.moveActor.call(context,player,{jump:true,forward:1},.2);
 assert.ok(player.y>1.1);
 assert.ok(player.z<0,'forward should move toward negative Z');
 assert.equal(player.vy,0,'gravity must not accumulate in flight');
 const hovered=player.y;
 Game.prototype.moveActor.call(context,player,{},.2);
 assert.equal(player.y,hovered,'hover must retain altitude without keys');
 Game.prototype.moveActor.call(context,player,{crouch:true},.2);
 assert.ok(player.y<hovered,'Ctrl must descend');
 assert.equal(player.crouching,false,'flight descent must not shrink actor capsule');
 assert.equal(player.height,1.7);
 player.flying=false;player.y=0;player.vy=0;
 Game.prototype.moveActor.call(context,player,{},.1);
 assert.ok(player.vy<=0,'normal gravity must resume after flight toggle');
});
test('Scope 5 is a real sniper rifle with original Cartridge Strike ammo/damage',()=>{
 assert.equal(WEAPONS.sniper.slot,'primary');
 assert.equal(WEAPONS.sniper.magazine,5);
 assert.ok(WEAPONS.sniper.damage>=100);
 assert.ok(WEAPONS.sniper.range>=100);
 assert.ok(WEAPONS.sniper.reload>2);
});
