import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioSystem,MAX_AUDIO_VOICES} from '../src/audio.mjs';

const keys=['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'];
function fixture({legacy=false}={}){
 const stats={nodes:[],sources:[],buffers:0,rays:0,listenerWrites:0,positions:[],orientations:[]};
 const param=(listener=false)=>({value:0,calls:[],setValueAtTime(v,t){this.value=v;this.calls.push([v,t]);if(listener)stats.listenerWrites++;},
  setTargetAtTime(v,t,c){this.calls.push([v,t,c]);},exponentialRampToValueAtTime(v,t){this.calls.push([v,t]);}});
 const node=kind=>{
  const n={kind,connections:[],disconnects:0,connect(to){this.connections.push(to);return to;},disconnect(){this.disconnects++;}};
  if(kind==='gain')n.gain=param();
  if(kind==='filter')n.frequency=param();
  if(kind==='panner')for(const key of ['positionX','positionY','positionZ'])n[key]=param();
  if(kind==='source'||kind==='oscillator'){
   Object.assign(n,{playbackRate:param(),frequency:param(),onended:null,start(t){this.started=t;},stop(t){this.stopped=t;},end(){this.onended?.();}});
   stats.sources.push(n);
  }
  stats.nodes.push(n);return n;
 };
 const ctx={state:'running',currentTime:3,sampleRate:8000,
  listener:legacy?{setPosition(...p){stats.positions.push(p);},setOrientation(...p){stats.orientations.push(p);}}:Object.fromEntries(keys.map(k=>[k,param(true)])),
  createGain:()=>node('gain'),createBiquadFilter:()=>node('filter'),createPanner:()=>node('panner'),
  createBufferSource:()=>node('source'),createOscillator:()=>node('oscillator'),
  createBuffer(ch,n){stats.buffers++;const data=new Float32Array(n);return {duration:n/ctx.sampleRate,getChannelData:()=>data};},
  async close(){this.state='closed';}};
 let wallClear=true;
 const world={roomAt:()=>null,segmentClear(a,b){stats.rays++;stats.lastRay=[{...a},{...b}];return wallClear;}};
 const audio=new AudioSystem(world,{volume:.55,ambient:false});audio.context=ctx;audio.master=ctx.createGain();
 audio.buffers.set('impactMetal_light_000',{duration:.5});
 const listener={id:'me',x:1,y:1.5,z:2,yaw:0,pitch:0};audio.updateListener(listener);
 return {audio,ctx,stats,listener,setClear:v=>{wallClear=v;}};
}
const shot=(extra={})=>({type:'shot',actorId:'enemy',weapon:'ar47',x:4,y:1.4,z:-3,...extra});

test('600 identical listener poses schedule no further AudioParam automation and retain position identity',()=>{
 const {audio,stats,ctx,listener}=fixture();const position=audio.listener;
 assert.equal(stats.listenerWrites,9);
 for(let i=0;i<600;i++){ctx.currentTime+=.016;audio.updateListener({...listener});}
 assert.equal(stats.listenerWrites,9);assert.equal(audio.listener,position);
 audio.updateListener({...listener,x:2});assert.equal(stats.listenerWrites,10);
 audio.updateListener({...listener,x:2,yaw:.3});assert.equal(stats.listenerWrites,12);
 assert.equal(audio.listenerValues[3],-Math.sin(.3));
});

test('listener identity, custom forward and reset/context replacement remain correct',()=>{
 const {audio,ctx,stats,listener}=fixture();
 audio.updateListener({...listener,id:'spectated',forward:{x:1,y:0,z:0}});
 assert.equal(audio.listenerId,'spectated');assert.equal(stats.listenerWrites,11);
 audio.updateListener({...listener,id:'driver',position:{x:3,y:5,z:6},forward:{x:0,y:.5,z:-.5}});
 assert.deepEqual(audio.listener,{x:3,y:5,z:6});assert.equal(audio.listenerId,'driver');
 audio.reset();const n=stats.listenerWrites;audio.updateListener(listener);assert.equal(stats.listenerWrites,n+9);
 const other=fixture();ctx.listener=other.ctx.listener;audio.updateListener(listener);
 assert.equal(other.stats.listenerWrites,18,'new native listener gets all values, even unchanged');
});

test('legacy Safari listener only receives changed position/orientation without losing reset',()=>{
 const {audio,stats,listener}=fixture({legacy:true});
 for(let i=0;i<600;i++)audio.updateListener(listener);
 assert.equal(stats.positions.length,1);assert.equal(stats.orientations.length,1);
 audio.updateListener({...listener,x:7});assert.equal(stats.positions.length,2);assert.equal(stats.orientations.length,1);
 audio.updateListener({...listener,x:7,pitch:.2});assert.equal(stats.orientations.length,2);
 audio.reset();audio.updateListener(listener);assert.equal(stats.positions.length,3);assert.equal(stats.orientations.length,3);
});

test('three-layer shot performs one real occlusion query with unchanged gains, filters, panning and timing',()=>{
 const {audio,ctx,stats,setClear}=fixture();setClear(false);audio.play(shot());
 assert.equal(stats.rays,1);assert.equal(audio.active.size,3);
 assert.equal(audio.stats.occluded,3,'per-layer stats retain original semantics');
 const channels=[...audio.active];
 assert.deepEqual(channels.map(x=>x.nodes[0].gain.value),[.65*.24,.32*.24,.12*.24]);
 assert.ok(channels.every(x=>x.nodes[1].frequency.value===780));
 assert.ok(channels.every(x=>x.nodes.find(n=>n.kind==='panner').positionX.value===4));
 assert.deepEqual(stats.sources.map(s=>s.started),[ctx.currentTime,ctx.currentTime,ctx.currentTime+.025]);
 assert.equal(audio.spatialEvent,null);assert.equal(audio.spatialSnapshot,null);
});

test('new events recheck doors and position; independent direct channels never retain occlusion',()=>{
 const {audio,stats,setClear}=fixture();const event=shot();
 setClear(false);audio.play(event);setClear(true);event.x=8;audio.play(event);
 assert.equal(stats.rays,2);assert.equal([...audio.active][3].nodes[0].gain.value,.65);
 assert.equal(stats.lastRay[1].x,8);
 const a=audio.channel(event);setClear(false);const b=audio.channel(event);
 assert.equal(stats.rays,4);assert.equal(a.gain.gain.value,1);assert.equal(b.gain.gain.value,.24);
 for(const c of [a,b])for(const n of c.nodes)n.disconnect();
});

test('own/global cues bypass world occlusion and panners; ignored events do not add rays',()=>{
 const {audio,stats}=fixture();audio.play(shot({actorId:'me'}));audio.play({type:'roundResult'});
 audio.play({type:'damage',actorId:'someone-else'});audio.play({type:'unknown'});
 assert.equal(stats.rays,0);assert.equal(stats.nodes.filter(n=>n.kind==='panner').length,0);
 assert.equal(audio.active.size,6);
});

test('one-event spatial cache clears after an exception and nested sound dispatch restores caller scope',()=>{
 const {audio,stats}=fixture();const old=audio.tone;
 audio.tone=()=>{throw Error('fixture error');};assert.throws(()=>audio.play(shot()),/fixture error/);
 assert.equal(audio.spatialEvent,null);assert.equal(audio.spatialSnapshot,null);audio.reset();
 audio.tone=function(...args){this.tone=old;this.play({type:'round'});return old.apply(this,args);};
 const n=stats.rays;audio.play(shot());assert.equal(stats.rays,n+1);
 assert.equal(audio.spatialEvent,null);
});

test('voice ceiling is enforced per layer before any allocation, including last slot of multilayer event',()=>{
 const {audio,stats}=fixture();const event={type:'beep',actorId:'me'};
 for(let i=0;i<MAX_AUDIO_VOICES-1;i++)audio.tone(event,400,2,.05);
 audio.play(shot());assert.equal(audio.active.size,MAX_AUDIO_VOICES);
 const nodes=stats.nodes.length,buffers=stats.buffers,sources=stats.sources.length,rays=stats.rays;
 for(let i=0;i<100;i++)audio.play(shot());
 assert.equal(stats.nodes.length,nodes);assert.equal(stats.buffers,buffers);
 assert.equal(stats.sources.length,sources);assert.equal(stats.rays,rays);
 assert.equal(audio.stats.dropped,302);
 // Natural ending frees a slot; never reuse or restart a one-shot AudioNode.
 const first=stats.sources[0];first.end();assert.equal(audio.active.size,95);
 audio.tone(event,400,.1,.05);assert.equal(audio.active.size,96);
 assert.notEqual(stats.sources.at(-1),first);
});

test('mute, pause/reset and disposal do not leave queued tails or allocate suppressed voices',async()=>{
 const {audio,ctx,stats}=fixture();audio.play({type:'reload',actorId:'me'});
 assert.equal(audio.active.size,3);const owned=[...audio.active];audio.reset();
 assert.equal(audio.active.size,0);for(const i of owned){assert.equal(i.source.onended,null);assert.equal(i.source.disconnects,1);}
 audio.reset();assert.ok(owned.every(i=>i.source.disconnects===1));
 audio.volume=0;const n=stats.nodes.length;audio.play(shot());assert.equal(stats.nodes.length,n);
 audio.volume=.5;ctx.state='suspended';audio.play(shot());assert.equal(stats.nodes.length,n);
 ctx.state='running';await audio.dispose();audio.play(shot());assert.equal(stats.nodes.length,n);
});

test('handle keeps stale/duplicate/muted sound suppression and rechecks after clock rewind',()=>{
 const {audio,stats,listener,setClear}=fixture();const e=shot({id:'one',time:8});
 audio.handle([e,e,shot({id:'one',time:8}),shot({time:7})],listener,8);
 assert.equal(stats.rays,1);assert.equal(audio.stats.duplicates,2);assert.equal(audio.stats.stale,1);
 setClear(false);audio.handle([shot({id:'one',time:0})],listener,0);
 assert.equal(stats.rays,2);assert.equal(audio.active.size,3);
 assert.equal(audio.listenerId,'me');
});
