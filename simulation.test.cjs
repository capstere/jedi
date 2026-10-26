'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const S=require('../source/simulation-core.js');
const E=require('../source/elevator.js');
const info=require('../source/model_manifest.json');
function setup(layout={objects:[],zones:[],keepClear:[]},angle=90,seed=123) {
  const door={angle,direction:1},messages=[];
  const sim=S.create({info,getLayout:()=>layout,getDoor:()=>door,getElevator:()=>E,seed,onMessage:t=>messages.push(t)});
  return {sim,layout,door,messages};
}
function advance(sim,seconds,step=1/30){for(let t=0;t<seconds;t+=step)sim.tick(step);}
function object(id,x,z,w,d,rot=0){return {id,type:'carton',name:id,x,z,y:.006,w,d,h:1,rot};}

test('clearance grid routes around rotated equipment without corner cutting',()=>{
  const obstacle=object('pallet',0,0,1.8,.8,35);
  const isClear=(x,z)=>Math.abs(x)<2.7&&Math.abs(z)<2.7&&!S.circleRect(x,z,S.RADIUS,obstacle);
  const grid=new S.NavigationGrid({west:-3,east:3,north:-3,south:3},isClear);
  const start={x:-2,z:0},end={x:2,z:0},path=grid.path(start,end);
  assert.ok(path?.length>1,'obstacle forces a detour');
  let previous=start;for(const point of path){assert.ok(grid.segment(previous,point));previous=point;}
  assert.equal(grid.path(start,{x:0,z:0}),null,'cannot route into equipment');
  const wallGrid=new S.NavigationGrid({west:-2,east:2,north:-2,south:2},(x,z)=>Math.abs(x)>.1);
  assert.equal(wallGrid.path({x:-1,z:0},{x:1,z:0}),null,'thin solid wall cannot be tunnelled through');
});

test('cabin is connected only through the open existing right door',()=>{
  const {sim,door}=setup(undefined,0);
  const cabin=E.spawn,room={x:0,z:-2};
  assert.ok(sim.isFree(cabin.x,cabin.z));
  assert.equal(sim.path(cabin,room),null);
  door.angle=90;sim.invalidate();
  assert.ok(sim.path(cabin,room)?.length);
  door.direction=-1;sim.invalidate();
  assert.ok(sim.path(cabin,room)?.length,'configurable inward/outward direction is respected');
  door.angle=0;
  assert.equal(sim.isFree(1.65,-3.8),false,'current physical door blocks immediately before next grid rebuild');
});

test('12 independent people stay clear of furniture and each other at 4×',()=>{
  const furniture=[object('pallet-a',-1.7,-1.3,1.2,.8,20),object('cart',1,.3,.82,.52,15),object('fridge',2.9,1.9,.8,.8),object('shelf',-2.8,-2,.45,1.8)];
  const {sim}=setup({objects:furniture,zones:[],keepClear:[]});
  for(let i=0;i<12;i++)assert.ok(sim.add({x:(i%4)*.68-1.1,z:1+Math.floor(i/4)*.7}));
  assert.equal(new Set(sim.people.map(p=>p.phase)).size,12);
  sim.setSpeed(4);sim.start();const begin=performance.now();
  for(let frame=0;frame<900;frame++){
    const before=sim.people.map(p=>({x:p.x,z:p.z}));sim.tick(1/60);
    sim.people.forEach((p,i)=>{
      assert.ok(sim.isFree(p.x,p.z),'person must stay on navigable floor');
      assert.ok(Math.hypot(p.x-before[i].x,p.z-before[i].z)<.08,'bounded swept movement');
      sim.people.slice(i+1).forEach(q=>assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=S.RADIUS*2-.0001,'people do not interpenetrate'));
    });
  }
  const milliseconds=performance.now()-begin;
  assert.ok(sim.people.every(p=>p.distance>4),'every NPC makes useful progress');
  assert.ok(sim.getStats().navVersion<5,'navigation is not rebuilt per frame');
  console.log('V5 CPU simulation benchmark: 12 NPCs, 60 simulated seconds, '+milliseconds.toFixed(1)+' ms total (not a GPU benchmark).');
});

test('changed layout invalidates navigation and trapped people wait instead of teleporting',()=>{
  const {sim,layout}=setup();const person=sim.add({x:0,z:0});sim.start();advance(sim,4);
  const old=sim.getStats().navVersion,position={x:person.x,z:person.z};
  layout.objects.push(object('new-blocker',person.x,person.z,1,1));sim.invalidate();advance(sim,2);
  assert.ok(sim.getStats().navVersion>old);
  assert.equal(person.x,position.x);assert.equal(person.z,position.z);
  assert.match(person.bubble,/Flytta hindret/);
  layout.objects.length=0;sim.invalidate();advance(sim,8);
  assert.ok(Math.hypot(person.x-position.x,person.z-position.z)>.4,'NPC resumes after obstruction is removed');
});

test('opposing people yield and clear an 80 cm corridor without permanent deadlock',()=>{
  const {sim}=setup({objects:[object('north-bank',0,-1.15,4,1.5),object('south-bank',0,1.15,4,1.5)],zones:[],keepClear:[]},0,6);
  const a=sim.add({x:-1.5,z:0}),b=sim.add({x:1.5,z:0});
  for(const [person,goal] of [[a,{x:2.6,z:0}],[b,{x:-2.6,z:0}]]){
    person.goal=goal;person.path=sim.path(person,goal);person.timer=0;person.state='walk';
  }
  sim.start();let aPassed=false,bPassed=false;
  for(let i=0;i<3600;i++){
    sim.tick(1/30);aPassed||=a.x>2.3;bPassed||=b.x< -2.3;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=S.RADIUS*2);
    if(aPassed&&bPassed)break;
  }
  assert.ok(aPassed&&bPassed,'both participants can leave the bottleneck');
});

test('MH waits for target and door, delivers four transient V4 bags, then returns',()=>{
  const {sim,layout,door,messages}=setup({objects:[object('station',0,.7,1.2,.7)],zones:[],keepClear:[]},0);
  const baseline=JSON.stringify(layout),person=sim.add({mode:'handler'});
  assert.ok(person.z<-3.8,'default MH starts in the cabin');
  sim.start();advance(sim,3);
  assert.equal(person.handlerStage,'missing');assert.ok(messages.some(x=>x.includes('destination')));
  sim.setDestination(person.id,{objectId:'station'});advance(sim,3);
  assert.equal(person.handlerStage,'waiting');assert.equal(sim.props.length,0);
  door.angle=90;sim.invalidate();advance(sim,65);
  assert.equal(person.handlerStage,'complete');
  assert.equal(sim.props.filter(p=>p.type==='sampleBag').length,4);
  assert.equal(sim.getStats().delivered,4);
  assert.ok(person.z<-3.8,'MH walks back into cabin');
  assert.equal(JSON.stringify(layout),baseline,'simulation never mutates furniture');
  sim.reset();assert.equal(sim.props.length,0);assert.equal(sim.running,false);
});

test('no-go zones, chaos props, pause and heatmap stay independent of layout saving',()=>{
  const layout={objects:[],zones:[{name:'Material',a:[-.7,.028,-.7],b:[.7,.028,.7]}],keepClear:[{id:'nogozone',name:'Stängd yta',x:-2,z:2,w:1,d:1,rot:0}]};
  const {sim}=setup(layout,90,8),baseline=JSON.stringify(layout);
  sim.setNoGoZones(['nogozone']);sim.invalidate();assert.equal(sim.isFree(-2,2),false);
  for(let i=0;i<4;i++)sim.add({x:-1.5+i*.75,z:1.4});
  sim.setChaos(true);sim.start();advance(sim,120);
  assert.ok(sim.getHeatmap().cells.length>20);
  assert.ok(sim.props.some(p=>p.source==='chaos'),'chaos places a temporary box in a marked zone');
  assert.equal(JSON.stringify(layout),baseline);
  sim.pause();const poses=JSON.stringify(sim.people.map(p=>[p.x,p.z,p.phase]));advance(sim,2);
  assert.equal(JSON.stringify(sim.people.map(p=>[p.x,p.z,p.phase])),poses);
  const heat=JSON.stringify(sim.getHeatmap());sim.collectHeatmap=false;sim.start();advance(sim,3);assert.equal(JSON.stringify(sim.getHeatmap()),heat);
  sim.setChaos(false);assert.equal(sim.props.filter(p=>p.source==='chaos').length,0);
  sim.resetHeatmap();assert.equal(sim.getHeatmap().cells.length,0);
  sim.reset();assert.equal(JSON.stringify(layout),baseline);
});

test('closed floor-tape zones are destinations and no-go areas; open tape is not',()=>{
  const {sim}=setup({objects:[],zones:[],keepClear:[],tapes:[
    {id:'ipt-station',name:'IPT SAMPLE POINTS',points:[[-.6,-.4],[.6,-.4],[.6,.4],[-.6,.4],[-.6,-.4]]},
    {id:'line',name:'Öppen tejplinje',points:[[1,1],[2,1],[2,2]]}
  ]});
  const destinations=sim.getDestinations();
  assert.equal(destinations.length,1);assert.equal(destinations[0].name,'IPT SAMPLE POINTS');
  const target=destinations[0];
  const handler=sim.add({mode:'handler',destination:{zoneId:target.id}});
  sim.start();advance(sim,55);
  assert.equal(sim.props.filter(p=>p.type==='sampleBag').length,4,'MH can deliver to the taped station');
  assert.equal(handler.handlerStage,'complete');
  sim.setNoGoZones([target.id]);assert.equal(sim.isFree(0,0),false,'same closed tape polygon can block navigation');
  sim.setNoGoZones([]);assert.equal(sim.isFree(0,0),true);
});

test('explicit configuration saves starts only; invalid import preserves current people',()=>{
  const {sim}=setup();const p=sim.add({x:0,z:0,appearance:'colleague-b',height:1.6});
  sim.start();advance(sim,8);
  const config=sim.exportConfig();assert.equal(config.people[0].x,0);assert.equal(config.people[0].z,0);assert.equal(config.people[0].appearance,'colleague-b');
  assert.equal(config.props,undefined);assert.equal(config.heatmap,undefined);
  const bad=structuredClone(config);bad.people[0].x=NaN;
  assert.throws(()=>sim.importConfig(bad),/Ogiltiga/);assert.equal(sim.people[0],p);
  for(const maxPeople of [Infinity,NaN,0,1.5,13,'4',null]){
    assert.throws(()=>sim.importConfig({...config,maxPeople}),/maxantal/);
    assert.equal(sim.people[0],p,'invalid settings leave the existing simulation intact');
  }
  assert.ok(sim.importConfig(config));assert.equal(sim.running,false);assert.equal(sim.people.length,1);assert.equal(sim.people[0].x,0);
  sim.update(sim.people[0].id,{mode:'stationary',paused:true,appearance:'colleague-c',height:1.9});
  assert.equal(sim.people[0].appearance,'colleague-c');
  assert.equal(sim.people[0].paused,true);
  assert.ok(sim.duplicate(sim.people[0].id));assert.equal(sim.people.length,2);
  assert.ok(sim.remove(sim.people[0].id));assert.equal(sim.people.length,1);
});

test('meeting and dance are temporary behaviours and return to ordinary navigation',()=>{
  const {sim}=setup();for(let i=0;i<4;i++)sim.add({x:i*.7-1,z:1});
  assert.equal(sim.meeting(),true);sim.start();advance(sim,20);
  sim.danceBreak();assert.ok(sim.people.every(p=>p.state==='dance'));
  advance(sim,7);assert.ok(sim.people.every(p=>p.state!=='dance'));
});
