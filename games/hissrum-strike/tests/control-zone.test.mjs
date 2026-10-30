import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCombat,tickCombat} from '../src/fps/combat-flow.mjs';
import {recordActionDeath,isEndless} from '../src/fps/action-rules.mjs';
import {resolveRound} from '../src/fps/game.mjs';
function fixture(){
 const actors=['analysts','counterAnalysts'].map((team,i)=>({id:team,team,x:i*20,y:0,z:0,alive:true,onGround:true,spawnProtectedUntil:0}));
 const g={actors,config:{respawnDelay:2.7},world:{segmentClear:()=>true},state:{mode:'control',time:0,phase:'active',score:{analysts:0,counterAnalysts:0},history:[]},events:[],emit(type,a,data){this.events.push({type,...data});},get phase(){return this.state.phase;}};
 initializeCombat({...g,state:{...g.state,mode:'classic'}});
 g.state.combatFlow={zones:[{id:'a',x:0,z:0,radius:3,name:'A'},{id:'b',x:10,z:0,radius:3,name:'B'}],index:0,rotateAt:60,owner:null,progress:0,hold:0,scores:{analysts:0,counterAnalysts:0}};
 return g;
}
const advance=(g,n)=>{for(let i=0;i<n*60;i++){g.state.time+=1/60;tickCombat(g,1/60);}};
test('control requires three seconds, awards only occupied hold time, and kills never score',()=>{
 const g=fixture();advance(g,2);assert.equal(g.state.combatFlow.owner,null);advance(g,1.1);
 assert.equal(g.state.combatFlow.owner,'analysts');assert.equal(g.state.score.analysts,0);
 advance(g,2);assert.equal(g.state.score.analysts,2);
 recordActionDeath(g,g.actors[1],g.actors[0]);assert.equal(g.state.score.analysts,2);assert.ok(g.actors[1].respawnAt>g.state.time);assert.equal(isEndless(g),true);
 g.actors[0].x=15;advance(g,5);assert.equal(g.state.score.analysts,2);
});
test('contesting stops scoring and resets capture; airborne, protected and occluded actors cannot capture',()=>{
 const g=fixture();g.actors[1].x=0;advance(g,4);assert.equal(g.state.combatFlow.contested,true);assert.equal(g.state.score.analysts,0);
 g.actors[1].x=20;
 for(const patch of [{onGround:false},{spawnProtectedUntil:100}]){Object.assign(g.actors[0],patch);advance(g,4);assert.equal(g.state.combatFlow.owner,null);Object.assign(g.actors[0],{onGround:true,spawnProtectedUntil:0});}
 g.world.segmentClear=()=>false;advance(g,4);assert.equal(g.state.combatFlow.owner,null);
 g.world.segmentClear=()=>true;advance(g,3.1);assert.equal(g.state.combatFlow.owner,'analysts');
 g.actors[1].x=0;advance(g,2);assert.equal(g.state.score.analysts,0);
});
test('rotation resets ownership but preserves score; pause prevents capture',()=>{
 const g=fixture();advance(g,5);const score=g.state.score.analysts;
 g.state.paused=true;advance(g,4);assert.equal(g.state.score.analysts,score);g.state.paused=false;
 g.state.time=60;tickCombat(g,1/60);const f=g.state.combatFlow;
 assert.equal(f.index,1);assert.equal(f.owner,null);assert.equal(f.progress,0);assert.equal(g.state.score.analysts,score);
});
test('first to 100 ends exactly once, caps score and cannot resolve via elimination',()=>{
 const g=fixture(),f=g.state.combatFlow;f.owner='analysts';f.scores.analysts=99;g.state.score.analysts=99;
 assert.equal(resolveRound(g.state,g.config),null);advance(g,2);
 assert.equal(g.phase,'match');assert.equal(g.state.result.winner,'analysts');assert.equal(g.state.score.analysts,100);
 assert.equal(g.events.filter(e=>e.type==='match').length,1);
});
