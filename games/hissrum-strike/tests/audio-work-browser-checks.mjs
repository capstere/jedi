import {AudioSystem,AUDIO_SAMPLES,MAX_AUDIO_VOICES} from '../src/audio.mjs';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const shot=()=>({type:'shot',actorId:'enemy',weapon:'ar47',x:4,y:1.4,z:-3});

/** Run directly from a user gesture. Native Web Audio nodes and locally
 * hosted, decoded game sounds are used; only the obstacle probe is a fixture. */
export async function runAudioWorkChecks(){
 let rays=0,clear=true,writes=0;
 const world={roomAt:()=>null,segmentClear:()=>{rays++;return clear;}};
 const audio=new AudioSystem(world,{volume:.12,ambient:false});
 const spies=[];
 try{
  check(await audio.unlock(),'Web Audio must unlock from the Start click');
  check(audio.buffers.size===AUDIO_SAMPLES.length,'All original local sound samples must decode');
  check(audio.errors.length===0,'Sound decoding failure: '+audio.errors.join('; '));
  const ctx=audio.context;
  for(const key of ['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ']){
   const param=ctx.listener[key],method=param.setValueAtTime;
   Object.defineProperty(param,'setValueAtTime',{configurable:true,value:function(...args){writes++;return method.apply(this,args);}});
   spies.push(param);
  }
  const listener={id:'me',x:1,y:1.5,z:2,yaw:0,pitch:0};
  audio.updateListener(listener);
  for(let i=0;i<600;i++)audio.updateListener(listener);
  check(writes===9,'Unchanged native listener pose should cause no duplicate automation');
  audio.updateListener({...listener,x:3});check(writes===10,'Movement must immediately update changed listener coordinate');
  audio.updateListener({...listener,x:3,id:'spectator'});check(audio.listenerId==='spectator','Spectator identity must still update');
  audio.updateListener(listener);
  clear=false;audio.play(shot());
  check(rays===1&&audio.active.size===3,'Three-layer shot should share one obstacle probe');
  check([...audio.active].every(i=>i.nodes[1].frequency.value===780),'Occluded sound layers should retain low-pass filtering');
  clear=true;audio.play(shot());
  check(rays===2&&audio.active.size===6,'New event must re-probe after changed obstruction');
  check([...audio.active].slice(3).every(i=>i.nodes[1].frequency.value===18000),'Fresh unobstructed shot must not reuse stale wall state');
  audio.reset();check(audio.active.size===0,'Reset must cancel all current and scheduled source tails');
  const own={type:'beep',actorId:'me'};audio.updateListener(listener);
  for(let i=0;i<MAX_AUDIO_VOICES-1;i++)audio.tone(own,400,2,.001);
  audio.play(shot());check(audio.active.size===MAX_AUDIO_VOICES,'Native voice ceiling must also hold halfway through layered shots');
  const n=audio.stats.dropped;
  for(let i=0;i<100;i++)audio.play(shot());
  check(audio.active.size===MAX_AUDIO_VOICES&&audio.stats.dropped===n+300,'Saturation must drop extra layers without adding voices');
  audio.reset();await sleep(35);check(audio.active.size===0,'Cancelled sources must not return after delayed ended events');
  audio.tone(own,400,.025,.001);check(audio.active.size===1,'Available slot should create a fresh one-shot source');
  const deadline=performance.now()+2000;
  while(audio.active.size&&performance.now()<deadline)await sleep(25);
  check(audio.active.size===0,'Native onended callback must free its voice');
  audio.setVolume(0);audio.play(shot());check(audio.active.size===0,'Muted output should allocate no sound sources');
  audio.setVolume(.12);await ctx.suspend();audio.play(shot());check(audio.active.size===0,'Suspended context should allocate no stale sources');
  check(await audio.unlock(),'Context should resume without re-decoding sounds');
  audio.updateListener(listener);audio.play({type:'reload',actorId:'me'});
  check(audio.active.size===3,'Reload sequence should preserve its scheduled layers');
  audio.reset();check(audio.active.size===0,'Pause/reset must cancel delayed reload sounds');
  return {decodedSamples:audio.buffers.size,stationaryUpdates:600,stationaryParamWrites:9,
    layeredShotQueries:1,voiceLimit:MAX_AUDIO_VOICES,endedCleanup:true,resetAndResume:true};
 }finally{
  for(const param of spies)delete param.setValueAtTime;
  await audio.dispose();
 }
}
