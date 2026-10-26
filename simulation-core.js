/* Hissrum 12 V5 — deterministic, offline, transient people simulation.
 * Navigation is a clearance-tested 18 cm grid with A*, corner checks and swept
 * movement. Furniture stays in LayoutCore; this module never mutates a layout.
 * Pausing freezes both behaviour and animation. Saved configurations contain
 * starting positions, not temporary deliveries, chaos props or heatmap samples.
 */
(function(root) {
  'use strict';
  const CELL=.18, RADIUS=.28, MAX_PEOPLE=12, SPEEDS=[.5,1,2,4];
  const APPEARANCES=['colleague-a','colleague-b','colleague-c','material-handler'];
  const TAU=Math.PI*2;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=Number.isFinite;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const angleDelta=(a,b)=>((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function randomGenerator(seed) {
    let value=(seed>>>0)||0x43ad18f1;
    return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};
  }
  function circleRect(x,z,r,o) {
    const a=(o.rot||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const dx=x-o.x,dz=z-o.z,u=c*dx+s*dz,v=-s*dx+c*dz;
    return Math.hypot(Math.max(0,Math.abs(u)-o.w/2),Math.max(0,Math.abs(v)-o.d/2))<r+.0001;
  }
  function zoneRect(z,index) {
    if(z.a&&z.b)return {id:z.id||'zone-'+index,name:z.name||'Zon '+(index+1),x:(z.a[0]+z.b[0])/2,z:(z.a[2]+z.b[2])/2,w:Math.abs(z.a[0]-z.b[0]),d:Math.abs(z.a[2]-z.b[2]),rot:0};
    return {...z,id:z.id||'clear-'+index};
  }
  function closedTapeZones(tapes=[]) {
    return tapes.flatMap((t,index)=>{
      const points=t.points;
      if(!Array.isArray(points)||points.length<4||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))return [];
      const first=points[0],last=points[points.length-1];
      if(Math.hypot(first[0]-last[0],first[1]-last[1])>.001)return [];
      const area=Math.abs(points.slice(1).reduce((sum,p,i)=>sum+points[i][0]*p[1]-p[0]*points[i][1],0))/2;
      if(area<.002)return [];
      const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),west=Math.min(...xs),east=Math.max(...xs),north=Math.min(...zs),south=Math.max(...zs);
      // A closed tape outline is an explicit planning zone. Its axis-aligned
      // bounding rectangle is deliberately conservative for no-go navigation.
      return [{id:'tape/'+(t.id||index),name:t.name||'Tejpzon '+(index+1),x:(west+east)/2,z:(north+south)/2,w:east-west,d:south-north,rot:0}];
    });
  }
  class MinHeap {
    constructor(){this.data=[];}
    push(id,score) {
      const d=this.data;let i=d.length;d.push({id,score});
      while(i){const p=(i-1)>>1;if(d[p].score<=score)break;d[i]=d[p];i=p;}d[i]={id,score};
    }
    pop() {
      const d=this.data,first=d[0],last=d.pop();if(!d.length)return first;
      let i=0;while(i*2+1<d.length){let n=i*2+1;if(n+1<d.length&&d[n+1].score<d[n].score)n++;if(d[n].score>=last.score)break;d[i]=d[n];i=n;}d[i]=last;return first;
    }
    get length(){return this.data.length;}
  }
  class NavigationGrid {
    constructor(bounds,isClear,cellSize=CELL) {
      this.bounds={...bounds};this.cellSize=cellSize;this.isClear=isClear;
      this.width=Math.ceil((bounds.east-bounds.west)/cellSize);
      this.height=Math.ceil((bounds.south-bounds.north)/cellSize);
      this.open=new Uint8Array(this.width*this.height);this.free=[];
      for(let i=0;i<this.open.length;i++){const p=this.point(i);if(isClear(p.x,p.z)){this.open[i]=1;this.free.push(i);}}
    }
    point(i){return {x:this.bounds.west+(i%this.width+.5)*this.cellSize,z:this.bounds.north+(Math.floor(i/this.width)+.5)*this.cellSize};}
    index(x,z){const c=Math.floor((x-this.bounds.west)/this.cellSize),r=Math.floor((z-this.bounds.north)/this.cellSize);return c<0||r<0||c>=this.width||r>=this.height?-1:r*this.width+c;}
    segment(a,b) {
      const n=Math.max(1,Math.ceil(distance(a,b)/.055));
      for(let i=0;i<=n;i++){const t=i/n;if(!this.isClear(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
      return true;
    }
    nearest(p,maxDistance=Infinity,requireSegment=false) {
      let best=-1,d2=maxDistance*maxDistance;
      for(const i of this.free){const q=this.point(i),d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<d2&&(!requireSegment||this.segment(p,q))){best=i;d2=d;}}
      return best;
    }
    path(from,to) {
      if(!this.isClear(from.x,from.z)||!this.isClear(to.x,to.z))return null;
      if(this.segment(from,to))return [{x:to.x,z:to.z}];
      const start=this.nearest(from,.6,true),end=this.nearest(to,.6,true);
      if(start<0||end<0)return null;
      const n=this.open.length,g=new Float64Array(n),parent=new Int32Array(n),closed=new Uint8Array(n),heap=new MinHeap();
      g.fill(Infinity);parent.fill(-1);g[start]=0;heap.push(start,0);
      const target=this.point(end),w=this.width;
      while(heap.length) {
        const current=heap.pop().id;if(closed[current])continue;closed[current]=1;if(current===end)break;
        const cx=current%w,cz=Math.floor(current/w),p=this.point(current);
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dz)continue;const x=cx+dx,z=cz+dz;
          if(x<0||z<0||x>=w||z>=this.height)continue;
          const next=z*w+x;if(!this.open[next]||closed[next])continue;
          if(dx&&dz&&(!this.open[cz*w+x]||!this.open[z*w+cx]))continue;
          const q=this.point(next);if(!this.segment(p,q))continue;
          const score=g[current]+Math.hypot(dx,dz)*this.cellSize;
          if(score<g[next]){g[next]=score;parent[next]=current;heap.push(next,score+distance(q,target));}
        }
      }
      if(!finite(g[end]))return null;
      const route=[];let i=end;while(i!==start){route.push(this.point(i));i=parent[i];if(i<0)return null;}
      route.push(this.point(start));route.reverse();route.push({x:to.x,z:to.z});
      const smooth=[];let anchor={x:from.x,z:from.z},cursor=0;
      while(cursor<route.length){let furthest=cursor;for(let j=cursor+1;j<route.length&&this.segment(anchor,route[j]);j++)furthest=j;smooth.push(route[furthest]);anchor=route[furthest];cursor=furthest+1;}
      return smooth;
    }
  }
  function create(options={}) {
    const info=options.info;if(!info||!info.bounds)throw Error('Simulationen saknar rummets gränser.');
    const getLayout=options.getLayout||(()=>({objects:[],zones:[]}));
    const getDoor=options.getDoor||(()=>({angle:0,direction:1}));
    const getElevator=options.getElevator||(()=>root.FreightElevatorGeometry);
    const onMessage=options.onMessage||(()=>{});
    const random=randomGenerator(options.seed??Date.now());
    const people=[],props=[],noGoZoneIds=[];
    let running=false,speed=1,chaos=false,heatmapVisible=false,collectHeatmap=true;
    let elapsed=0,realClock=0,lastNavCheck=-Infinity,lastSignature='',grid=null,navVersion=0,serial=0,heatTime=0,delivered=0;
    let obstacles=[],noGo=[],door={angle:0,direction:1},elevator=null,layout={objects:[]};
    let forcedInvalidation=true,chaosClock=0;
    const heat=new Map();
    let maxPeople=clamp(options.maxPeople||MAX_PEOPLE,1,MAX_PEOPLE);
    function message(text){api.message=text;onMessage(text);}
    function allZones(){return [...(layout.zones||[]).map(zoneRect),...(layout.keepClear||[]).map(zoneRect),...closedTapeZones(layout.tapes)];}
    function staticClear(x,z,r=RADIUS) {
      if(!finite(x)||!finite(z))return false;
      if(elevator?.isNavigable){if(!elevator.isNavigable(x,z,r,door.angle,door.direction))return false;}
      else {const b=info.bounds;if(x<b.west+r||x>b.east-r||z<b.north+r||z>b.south-r)return false;}
      if(elevator?.doorwayBlocked?.(x,z,r,door.angle,door.direction))return false;
      // The leaf is tested independently even when an embedding app supplies
      // cabin bounds without its own geometry helper.
      const a=door.angle*Math.PI/180,l=1.394,hx=2.44,hz=-3.755;
      const tip={x:hx-l*Math.cos(a),z:hz+door.direction*l*Math.sin(a)};
      const dx=tip.x-hx,dz=tip.z-hz,t=clamp(((x-hx)*dx+(z-hz)*dz)/(l*l),0,1);
      if(Math.hypot(x-(hx+dx*t),z-(hz+dz*t))<r+.045)return false;
      for(const o of obstacles)if(circleRect(x,z,r,o))return false;
      for(const o of noGo)if(circleRect(x,z,r,o))return false;
      return true;
    }
    function refreshNavigation(force=false) {
      // The physical door is checked at its current animated angle every tick,
      // even though rebuilding the navigation grid is deliberately throttled.
      const latestDoor=getDoor()||{};door={angle:clamp(latestDoor.degrees??latestDoor.angle??0,0,90),direction:latestDoor.direction===-1?-1:1};
      if(!force&&!forcedInvalidation&&realClock-lastNavCheck<.25)return false;
      lastNavCheck=realClock;layout=getLayout()||{objects:[]};elevator=getElevator()||null;
      const furniture=(layout.objects||[]).filter(o=>(o.y||.006)<1.75&&(o.y||.006)+(o.h||0)>.06);
      const zones=allZones();
      const signature=JSON.stringify([furniture.map(o=>[o.id,o.x,o.z,o.rot,o.w,o.d,o.y,o.h]),props.filter(p=>p.blocking).map(o=>[o.id,o.x,o.z]),zones.filter(z=>noGoZoneIds.includes(z.id)),Math.round(door.angle/3),door.direction]);
      if(!force&&!forcedInvalidation&&signature===lastSignature)return false;
      lastSignature=signature;forcedInvalidation=false;
      obstacles=[...(info.fixedObstructions||[]).map(o=>({x:(o.x1+o.x2)/2,z:(o.z1+o.z2)/2,w:o.x2-o.x1,d:o.z2-o.z1,rot:0})),...furniture,...props.filter(p=>p.blocking)];
      noGo=zones.filter(z=>noGoZoneIds.includes(z.id));
      const bounds={...info.bounds};if(elevator?.bounds){bounds.north=Math.min(bounds.north,elevator.bounds.north);bounds.west=Math.min(bounds.west,elevator.bounds.west);bounds.east=Math.max(bounds.east,elevator.bounds.east);}
      grid=new NavigationGrid(bounds,staticClear);navVersion++;
      for(const p of people){p.path=[];p.navVersion=navVersion;p.retry=0;}
      return true;
    }
    function invalidate(){forcedInvalidation=true;}
    function canOccupy(p,x,z,gap=.012) {
      if(!staticClear(x,z,p.radius))return false;
      return people.every(q=>q.id===p.id||Math.hypot(q.x-x,q.z-z)>=p.radius+q.radius+gap);
    }
    function clearSegment(p,a,b) {
      if(!grid.segment(a,b))return false;
      const n=Math.max(1,Math.ceil(distance(a,b)/.06));
      for(let i=1;i<=n;i++){const t=i/n;if(!canOccupy(p,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
      return true;
    }
    function findPlacement(point,excludeId=null,maxDistance=1.5) {
      refreshNavigation();
      const dummy={id:excludeId,radius:RADIUS};
      if(canOccupy(dummy,point.x,point.z))return {x:point.x,z:point.z};
      let best=null,d=maxDistance;
      for(const index of grid.free){const q=grid.point(index),dist=distance(point,q);if(dist<d&&canOccupy(dummy,q.x,q.z)){best=q;d=dist;}}
      return best;
    }
    function setBubble(p,text,duration=3){p.bubble=text;p.bubbleUntil=elapsed+duration;}
    function randomWait(p,min=.7,max=2.8) {
      p.state=random()<.38?'look':random()<.25?'gesture':'idle';p.timer=min+random()*(max-min);p.path=[];p.goal=null;p.walkSpeed=0;p.blocked=0;
    }
    function route(p,target) {
      const path=grid.path(p,target);if(!path)return false;
      p.path=path;p.goal={x:target.x,z:target.z};p.state='walk';p.blocked=0;p.bestDistance=Infinity;p.progressTime=elapsed;p.navVersion=navVersion;return true;
    }
    function roam(p) {
      for(let i=0;i<22;i++) {
        const target=grid.point(grid.free[Math.floor(random()*grid.free.length)]);
        if(!target||distance(p,target)<1.1)continue;
        if(!canOccupy(p,target.x,target.z,.08))continue;
        if(route(p,target))return true;
      }
      randomWait(p,1,2);return false;
    }
    function resolveTarget(target) {
      if(!target)return null;
      if(target.objectId){const o=(layout.objects||[]).find(o=>o.id===target.objectId);return o?{...o,kind:'object'}:null;}
      if(target.zoneId){const z=allZones().find(z=>z.id===target.zoneId);return z?{...z,kind:'zone'}:null;}
      return null;
    }
    function approachTarget(p,target) {
      const o=resolveTarget(target);if(!o)return null;
      // Find a reachable point close to the target boundary. Never send a person
      // to the centre of a shelf or use a target behind a closed door.
      const candidates=[];
      for(const id of grid.free){const q=grid.point(id);if(distance(q,o)>Math.hypot(o.w||0,o.d||0)/2+1.3)continue;
        if(canOccupy(p,q.x,q.z,.02))candidates.push({...q,score:distance(q,o)+distance(p,q)*.08});}
      candidates.sort((a,b)=>a.score-b.score);
      for(const q of candidates.slice(0,70)){const path=grid.path(p,q);if(path)return {point:q,path,target:o};}
      return null;
    }
    function handler(p) {
      if(!resolveTarget(p.destination)){p.state='idle';p.walkSpeed=0;p.timer=1;p.handlerStage='missing';setBubble(p,'Välj upphämtningsstation',3);if(!p.missingAnnounced){message('Material Handler behöver en destination. Välj en markerad zon eller ett objekt.');p.missingAnnounced=true;}return;}
      p.missingAnnounced=false;
      const lift=elevator?.spawn||{x:1.65,z:-3.05};
      if(p.handlerStage==='complete'){p.state='idle';return;}
      if(!p.handlerStage||p.handlerStage==='missing'||p.handlerStage==='waiting'){
        if(elevator&&door.angle<55){p.handlerStage='waiting';p.state='idle';p.timer=.6;setBubble(p,'Jag väntar på hissen.',1);return;}
        const destination=approachTarget(p,p.destination);
        if(!destination){p.state='idle';p.timer=1.4;p.handlerStage='waiting';setBubble(p,'Vägen till stationen är blockerad.',2);return;}
        p.handlerStage='outbound';p.carryBag=true;p.path=destination.path;p.goal=destination.point;p.state='walk';return;
      }
      if(p.handlerStage==='outbound'){
        // If furniture moved en route, recompute its approach, not its old centre.
        const destination=approachTarget(p,p.destination);if(destination){p.path=destination.path;p.goal=destination.point;p.state='walk';}
        else {p.state='idle';p.timer=.8;}return;
      }
      if(p.handlerStage==='delivering'){
        p.handlerStage='return';p.carryBag=false;
      }
      if(p.handlerStage==='return'){
        if(elevator&&door.angle<55){p.state='idle';p.timer=.6;setBubble(p,'Öppna hissdörren så går jag tillbaka.',2);return;}
        if(!route(p,lift)){p.state='idle';p.timer=1;setBubble(p,'Vägen till hissen är blockerad.',2);}
      }
    }
    function dropDelivery(p) {
      const o=resolveTarget(p.destination);if(!o)return;
      let y=.008,x=o.x,z=o.z,w=o.w||.8,d=o.d||.6;
      if(o.kind==='object'){
        const supports=root.LayoutCore?.surfaces?.(o)||[];
        const support=supports.find(s=>s.w>=.50&&s.d>=.26)||supports.find(s=>s.w>=.24&&s.d>=.12);
        if(support){y=support.y+.004;x=support.x;z=support.z;w=support.w;d=support.d;}
        else {y=(o.y||.006)+(o.h||0)+.004;}
      }
      // Four independently rendered V4 bags (10 cartridges in each) are
      // temporary simulation props. Stack if the selected support is small.
      for(let i=0;i<4;i++){const fit=w>=.50&&d>=.26,dx=fit?(i%2-.5)*.25:0,dz=fit?(Math.floor(i/2)-.5)*.13:0;
        const a=(o.rot||0)*Math.PI/180;
        props.push({id:'delivery-'+p.id+'-'+i+'-'+serial++,type:'sampleBag',name:'Tillfällig leverans',x:x+dx*Math.cos(a)-dz*Math.sin(a),z:z+dx*Math.sin(a)+dz*Math.cos(a),y:y+(fit?0:i*.095),w:.24,d:.12,h:.09,rot:o.rot||0,blocking:false,temporary:true,source:'handler'});
      }
      delivered+=4;p.carryBag=false;setBubble(p,'4 påsar!',3);p.handlerStage='delivering';p.state='gesture';p.timer=2.6;p.path=[];p.goal=null;
    }
    function reached(p) {
      p.walkSpeed=0;p.path=[];p.goal=null;p.blocked=0;
      if(p.mode==='handler'){
        if(p.handlerStage==='outbound')dropDelivery(p);
        else if(p.handlerStage==='return'){p.handlerStage='complete';p.state='idle';setBubble(p,'Levererat. Klart!',3);}
        return;
      }
      if(p.meeting){p.state='gesture';p.timer=5+random()*3;setBubble(p,'Vi behöver nog ett möte.',3);p.meeting=false;return;}
      randomWait(p);
      if(chaos&&random()<.65){const lines=['Var ska den här stå?','4 påsar!','Är det här 5S?','Det stod här igår…','Vem äger den här zonen?'];setBubble(p,lines[Math.floor(random()*lines.length)]);if(random()<.35)p.state='phone';}
    }
    function makeYieldRoute(p) {
      // One participant yields by walking to a nearby free pocket. Positions are
      // never teleported. If no pocket exists, it waits and periodically replans.
      const others=people.filter(q=>q.id!==p.id&&distance(p,q)<1.2);
      const blocker=others.sort((a,b)=>distance(p,a)-distance(p,b))[0];if(!blocker)return false;
      if(p.id<blocker.id&&p.blocked<3)return false;
      const candidates=grid.free.map(i=>grid.point(i)).filter(q=>distance(p,q)>.55&&distance(p,q)<1.6&&distance(q,blocker)>distance(p,blocker)+.2&&canOccupy(p,q.x,q.z,.12));
      candidates.sort((a,b)=>distance(p,a)-distance(p,b));
      for(const q of candidates.slice(0,35))if(clearSegment(p,p,q)){p.resumeGoal=p.goal;p.path=[q];p.goal=q;p.state='walk';p.yielding=true;p.blocked=0;return true;}
      return false;
    }
    function movePerson(p,dt) {
      if(!staticClear(p.x,p.z,p.radius)){p.state='idle';p.walkSpeed=0;p.path=[];p.timer=.7;p.waitTime+=dt;setBubble(p,'Flytta hindret eller min startposition.',1);return;}
      if(!p.path.length){if(p.mode==='handler')handler(p);else if(p.goal&&!route(p,p.goal))randomWait(p,.5,1.2);else if(!p.goal)roam(p);return;}
      while(p.path.length&&distance(p,p.path[0])<.075){p.path.shift();p.bestDistance=Infinity;p.progressTime=elapsed;}
      if(!p.path.length){
        if(p.yielding){p.yielding=false;const next=p.resumeGoal;p.resumeGoal=null;p.goal=next;if(next&&route(p,next))return;randomWait(p,.7,1.2);return;}
        reached(p);return;
      }
      const next=p.path[0],dx=next.x-p.x,dz=next.z-p.z,length=Math.hypot(dx,dz),desiredYaw=Math.atan2(dx,dz);
      const turn=angleDelta(p.yaw,desiredYaw);p.yaw+=clamp(turn,-3.6*dt,3.6*dt);
      // Turns are visible and forward movement slows until the body faces its path.
      const step=Math.min(length,p.speed*dt*clamp(1-Math.abs(turn)/2.6,.12,1));
      const target={x:p.x+dx/length*step,z:p.z+dz/length*step};
      let candidate=clearSegment(p,p,target)?target:null;
      if(!candidate) {
        // Small sidesteps only: static clearance and the entire swept segment
        // must be valid, so avoidance cannot tunnel across a thin pallet.
        const sign=(parseInt(p.id.replace(/\D/g,''),10)||0)%2?1:-1;
        for(const a of [sign*.55,-sign*.55,sign*1.0,-sign*1.0]){
          const ux=dx/length,uz=dz/length,q={x:p.x+(ux*Math.cos(a)-uz*Math.sin(a))*step*.75,z:p.z+(ux*Math.sin(a)+uz*Math.cos(a))*step*.75};
          if(clearSegment(p,p,q)){candidate=q;break;}
        }
      }
      if(candidate){
        const travelled=distance(p,candidate);p.x=candidate.x;p.z=candidate.z;p.distance+=travelled;p.walkSpeed=travelled/dt;
        p.state=Math.abs(turn)>1.05?'turn':'walk';p.blocked=Math.max(0,p.blocked-dt*.5);
        // Repeated sidestepping without waypoint progress eventually triggers
        // yielding too, rather than allowing an endless orbit around another NPC.
        if(length<p.bestDistance-.035){p.bestDistance=length;p.progressTime=elapsed;}
        else if(elapsed-p.progressTime>2.3){p.blocked+=dt*2;}
      }else {p.walkSpeed=0;p.state='idle';p.blocked+=dt;p.waitTime+=dt;}
      if(p.blocked>1.1){
        if(!makeYieldRoute(p)&&p.blocked>3.5){p.path=[];p.timer=.7+random();p.state='idle';p.blocked=0;p.retry++;if(p.mode!=='handler'&&p.retry>2){p.goal=null;p.retry=0;}}
      }
    }
    function chaosEvent() {
      if(!chaos||!people.length)return;
      const p=people[Math.floor(random()*people.length)];if(p.paused||p.mode==='handler')return;
      const lines=['Var ska den här stå?','Vi behöver nog ett möte.','Är det här 5S?','Det stod här igår…','Vem äger den här zonen?'];
      setBubble(p,lines[Math.floor(random()*lines.length)],3.5);
      if(random()<.35){p.state='phone';p.timer=3+random()*3;p.path=[];p.goal=null;}
      // A deliberately misplaced box is allowed only inside a user-marked zone.
      // At most three boxes exist and are excluded from every layout export.
      if(props.filter(q=>q.source==='chaos').length>=3||random()>.65)return;
      const zones=allZones().filter(z=>z.w>.4&&z.d>.4&&!noGoZoneIds.includes(z.id));
      if(!zones.length)return;
      const zone=zones[Math.floor(random()*zones.length)];
      const item={id:'chaos-'+serial++,type:'carton',name:'Tillfällig KAIZEN-kartong',x:zone.x,z:zone.z,y:.006,w:.36,d:.30,h:.27,rot:zone.rot||0,params:{open:false},blocking:true,temporary:true,source:'chaos'};
      if(!staticClear(item.x,item.z,.24)||people.some(q=>distance(q,item)<.7)||props.some(q=>distance(q,item)<.6))return;
      // First walk to the zone before dropping anything: chaos is visible
      // behaviour, never a surprise permanent edit to the user's room.
      const candidates=grid.free.map(i=>grid.point(i)).filter(q=>distance(q,item)>.72&&distance(q,item)<1.25&&canOccupy(p,q.x,q.z,.08));
      candidates.sort((a,b)=>distance(p,a)-distance(p,b));
      for(const q of candidates.slice(0,30)){const path=grid.path(p,q);if(path){p.pendingDrop=item;p.path=path;p.goal=q;p.state='walk';p.timer=0;break;}}
    }
    function advancePerson(p,dt) {
      if(p.paused)return;
      p.phase+=dt;if(p.bubbleUntil<elapsed)p.bubble='';
      if(p.danceUntil>elapsed){p.state='dance';p.walkSpeed=0;return;}
      if(p.state==='dance'){p.path=[];p.goal=null;randomWait(p,.2,.7);}
      if(p.mode==='stationary'){p.walkSpeed=0;p.timer-=dt;if(p.timer<=0)randomWait(p,1,4);return;}
      if(p.timer>0&&!p.path.length){p.timer-=dt;p.waitTime+=dt;return;}
      if(p.pendingDrop&&p.goal&&distance(p,p.goal)<.30){
        const item=p.pendingDrop;p.pendingDrop=null;
        if(chaos&&!people.some(q=>distance(q,item)<q.radius+.26)&&staticClear(item.x,item.z,.24)){props.push(item);invalidate();setBubble(p,'Det stod här igår…',3);}
      }
      if(p.mode==='handler'&&!p.path.length&&p.handlerStage==='complete'){p.state='idle';p.walkSpeed=0;return;}
      movePerson(p,dt);
    }
    function tick(realSeconds) {
      const realDt=clamp(Number(realSeconds)||0,0,.25);realClock+=realDt;
      refreshNavigation();
      if(!running||!people.length)return false;
      const total=realDt*speed,steps=Math.max(1,Math.ceil(total/.045)),dt=total/steps;
      for(let s=0;s<steps;s++){
        elapsed+=dt;
        // Alternate evaluation order so the same actor does not always win a gap.
        const ordered=Math.floor(elapsed*2)%2?people:people.slice().reverse();
        for(const p of ordered)advancePerson(p,dt);
        heatTime+=dt;
        if(heatTime>=.20){
          if(collectHeatmap)for(const p of people){const i=grid.index(p.x,p.z);if(i>=0)heat.set(i,(heat.get(i)||0)+heatTime);}
          heatTime=0;
        }
        chaosClock-=dt;if(chaosClock<=0){chaosClock=6+random()*7;chaosEvent();}
      }
      return true;
    }
    function add(spec={}) {
      if(people.length>=maxPeople){message('Högst '+maxPeople+' personer med vald prestandanivå.');return null;}
      refreshNavigation();
      const spawn=spec.mode==='handler'?(elevator?.spawn||{x:1.65,z:-3.05}):{x:0,z:0};
      const requested={x:finite(spec.x)?spec.x:spawn.x,z:finite(spec.z)?spec.z:spawn.z},point=findPlacement(requested,null,1.5);
      if(!point){message('Här finns ingen fri golvyta för personen. Välj en annan plats.');return null;}
      const id='npc-'+(++serial),mode=['roam','stationary','handler'].includes(spec.mode)?spec.mode:'roam';
      const p={id,name:String(spec.name||(mode==='handler'?'Material Handler':'Kollega '+people.length)).slice(0,50),appearance:APPEARANCES.includes(spec.appearance)?spec.appearance:mode==='handler'?'material-handler':APPEARANCES[people.length%3],
        height:clamp(Number(spec.height)||1.72,1.45,1.95),x:point.x,z:point.z,y:.006,yaw:finite(spec.yaw)?spec.yaw:random()*TAU,
        radius:RADIUS,speed:.68+random()*.25,mode,paused:!!spec.paused,state:'idle',phase:random()*5,walkSpeed:0,path:[],goal:null,timer:.8+random()*2.2,blocked:0,distance:0,waitTime:0,retry:0,bestDistance:Infinity,progressTime:elapsed,navVersion,
        carryBag:false,bubble:'',bubbleUntil:0,destination:spec.destination?copy(spec.destination):null,handlerStage:'',danceUntil:0};
      p.start={x:p.x,z:p.z,yaw:p.yaw};people.push(p);
      if(mode==='handler'&&!p.destination){p.timer=0;handler(p);}
      message(mode==='handler'?'Material Handler tillagd. Välj destination och öppna hissen.':'Person tillagd. Starta simuleringen för fri vandring.');
      return p;
    }
    function update(id,patch={}) {
      const p=people.find(p=>p.id===id);if(!p)return null;
      if(APPEARANCES.includes(patch.appearance))p.appearance=patch.appearance;
      if(finite(patch.height))p.height=clamp(patch.height,1.45,1.95);
      if(typeof patch.name==='string')p.name=patch.name.slice(0,50);
      if(typeof patch.paused==='boolean')p.paused=patch.paused;
      if(['roam','stationary','handler'].includes(patch.mode)){p.mode=patch.mode;p.path=[];p.goal=null;p.handlerStage='';p.carryBag=false;p.timer=.2;}
      if(patch.destination!==undefined)setDestination(id,patch.destination);
      if(finite(patch.x)&&finite(patch.z))move(id,patch.x,patch.z);
      if(finite(patch.yaw)){p.yaw=patch.yaw;p.start.yaw=patch.yaw;}
      return p;
    }
    function move(id,x,z) {
      const p=people.find(p=>p.id===id);if(!p)return false;refreshNavigation(true);
      // User moves may snap nearby at placement time. Autonomous motion never
      // uses this operation and never changes a person's stored start position.
      const point=findPlacement({x,z},id,.55);if(!point){message('Platsen blockeras av ett föremål eller en person.');return false;}
      p.x=point.x;p.z=point.z;p.start={x:p.x,z:p.z,yaw:p.yaw};p.path=[];p.goal=null;p.handlerStage='';p.timer=.4;p.state='idle';p.pendingDrop=null;return true;
    }
    function remove(id){const index=people.findIndex(p=>p.id===id);if(index<0)return false;people.splice(index,1);return true;}
    function duplicate(id){const p=people.find(p=>p.id===id);if(!p)return null;return add({...p,x:p.x+.65,z:p.z,destination:p.destination});}
    function setDestination(id,target){const p=people.find(p=>p.id===id);if(!p)return false;p.destination=target?copy(target):null;p.path=[];p.goal=null;p.handlerStage='';p.timer=.1;p.missingAnnounced=false;return true;}
    function start(){running=true;message('Simulationen körs. Möbleringen sparas separat.');}
    function pause(){running=false;}
    function reset() {
      running=false;props.length=0;elapsed=0;delivered=0;heat.clear();heatTime=0;chaosClock=4;
      invalidate();refreshNavigation(true);
      for(const p of people){p.x=p.start.x;p.z=p.start.z;p.yaw=p.start.yaw;p.path=[];p.goal=null;p.distance=0;p.waitTime=0;p.carryBag=false;p.bubble='';p.handlerStage='';p.pendingDrop=null;p.danceUntil=0;p.bestDistance=Infinity;p.progressTime=0;randomWait(p,.5,2);}
      message('Simulationen återställd. Ursprunglig möblering är oförändrad.');
    }
    function setChaos(value) {
      chaos=!!value;chaosClock=1.5;
      if(!chaos){for(let i=props.length-1;i>=0;i--)if(props[i].source==='chaos')props.splice(i,1);for(const p of people)p.pendingDrop=null;invalidate();}
      message(chaos?'KAIZEN CHAOS är aktivt. Kartonger kan bara lämnas i markerade zoner.':'KAIZEN CHAOS avstängt. Tillfälliga kaosobjekt är borttagna.');
    }
    function setSpeed(value){if(SPEEDS.includes(Number(value)))speed=Number(value);}
    function setNoGoZones(ids){noGoZoneIds.splice(0,noGoZoneIds.length,...Array.from(new Set((ids||[]).filter(x=>typeof x==='string'))));invalidate();}
    function getDestinations(){layout=getLayout()||{objects:[]};return [...(layout.objects||[]).map(o=>({id:o.id,objectId:o.id,kind:'object',name:o.name||o.type,x:o.x,z:o.z})),...allZones().map(z=>({id:z.id,zoneId:z.id,kind:'zone',name:z.name,x:z.x,z:z.z}))];}
    function getHeatmap() {
      if(!grid)return {cells:[],cellSize:CELL,bounds:{...info.bounds},maxSeconds:0};
      const maximum=Math.max(0,...heat.values());
      return {cells:Array.from(heat,([i,seconds])=>({...grid.point(i),value:maximum?seconds/maximum:0,seconds})),cellSize:CELL,bounds:grid.bounds,maxSeconds:maximum};
    }
    function getStats(){return {distance:people.reduce((sum,p)=>sum+p.distance,0),waitTime:people.reduce((sum,p)=>sum+p.waitTime,0),elapsed,people:people.length,delivered,blocked:people.filter(p=>p.blocked>1||!staticClear(p.x,p.z)).length,navCells:grid?.free.length||0,navVersion};}
    function meeting() {
      refreshNavigation();const active=people.filter(p=>!p.paused&&p.mode==='roam').slice(0,5);
      if(active.length<3){message('Lägg till minst tre vandrande kollegor för ett Kaizen-möte.');return false;}
      for(const index of grid.free.slice().sort(()=>random()-.5).slice(0,120)) {
        const center=grid.point(index),targets=active.map((_,i)=>({x:center.x+Math.cos(i/active.length*TAU)*.85,z:center.z+Math.sin(i/active.length*TAU)*.85}));
        if(!targets.every(q=>staticClear(q.x,q.z)))continue;
        const routes=active.map((p,i)=>grid.path(p,targets[i]));if(routes.some(r=>!r))continue;
        active.forEach((p,i)=>{p.path=routes[i];p.goal=targets[i];p.meeting=true;p.timer=0;p.state='walk';setBubble(p,'Snabbt Kaizen-möte?',2);});message('Kollegorna samlas på en fri yta.');return true;
      }
      message('Det finns ingen tillräckligt stor ledig mötesyta.');return false;
    }
    function danceBreak(){for(const p of people)if(!p.paused){p.danceUntil=elapsed+5.5;p.state='dance';p.walkSpeed=0;}message('Dance Break! Kollegorna återgår till sina uppgifter efter pausen.');}
    function exportConfig() {
      return {format:'hissrum12-v5-simulation',version:1,speed,chaos,maxPeople,noGoZoneIds:noGoZoneIds.slice(),
        people:people.map(p=>({name:p.name,appearance:p.appearance,height:p.height,mode:p.mode,paused:p.paused,x:p.start.x,z:p.start.z,yaw:p.start.yaw,destination:p.destination?copy(p.destination):null}))};
    }
    function importConfig(value) {
      if(!value||value.format!=='hissrum12-v5-simulation'||value.version!==1||!Array.isArray(value.people)||value.people.length>MAX_PEOPLE)throw Error('Ogiltig simulationskonfiguration.');
      const validated=value.people.map(p=>{
        if(!p||!finite(p.x)||!finite(p.z)||Math.abs(p.x)>15||Math.abs(p.z)>15||!finite(p.height)||p.height<1.45||p.height>1.95||!APPEARANCES.includes(p.appearance)||!['roam','stationary','handler'].includes(p.mode)||!finite(p.yaw))throw Error('Ogiltiga persondata i simulationsfilen.');
        if(p.destination&&(!(typeof p.destination.objectId==='string'||typeof p.destination.zoneId==='string')||Object.keys(p.destination).some(k=>!['objectId','zoneId'].includes(k))))throw Error('Ogiltig destination i simulationsfilen.');
        return copy(p);
      });
      if(!Array.isArray(value.noGoZoneIds)||value.noGoZoneIds.length>64||value.noGoZoneIds.some(x=>typeof x!=='string'||x.length>128))throw Error('Ogiltiga no-go-zoner.');
      if(!SPEEDS.includes(value.speed)||typeof value.chaos!=='boolean')throw Error('Ogiltiga simulationsinställningar.');
      if(value.maxPeople!==undefined&&(!Number.isInteger(value.maxPeople)||value.maxPeople<1||value.maxPeople>MAX_PEOPLE))throw Error('Ogiltigt maxantal personer. Välj ett heltal mellan 1 och '+MAX_PEOPLE+'.');
      // Resolve all placements in an isolated runtime first. A bad import must
      // not delete the user's currently placed people or half-load a scenario.
      const probe=create({info,getLayout,getDoor,getElevator,seed:77});
      probe.setNoGoZones(value.noGoZoneIds);
      for(const p of validated)if(!probe.add(p))throw Error('En sparad startposition blockeras av den aktuella möbleringen.');
      running=false;people.length=0;props.length=0;heat.clear();elapsed=0;delivered=0;maxPeople=MAX_PEOPLE;
      setNoGoZones(value.noGoZoneIds);setSpeed(value.speed);setChaos(value.chaos);refreshNavigation(true);
      for(const p of probe.people)add({...p,x:p.start.x,z:p.start.z,yaw:p.start.yaw});
      maxPeople=clamp(value.maxPeople||MAX_PEOPLE,people.length||1,MAX_PEOPLE);
      message('Simulationskonfiguration importerad. Starta för att spela upp den.');return true;
    }
    const api={people,props,noGoZoneIds,tick,add,update,remove,duplicate,move,start,pause,reset,setChaos,setSpeed,setNoGoZones,setDestination,getDestinations,getHeatmap,getStats,exportConfig,importConfig,invalidate,meeting,danceBreak,
      resetHeatmap(){heat.clear();heatTime=0;},
      isFree(x,z){refreshNavigation();return staticClear(x,z);},
      path(from,to){refreshNavigation();return grid.path(from,to);},
      get running(){return running;},get speed(){return speed;},get chaos(){return chaos;},
      get elapsed(){return elapsed;},get maxPeople(){return maxPeople;},set maxPeople(n){maxPeople=clamp(Math.round(n)||4,1,MAX_PEOPLE);},
      get heatmapVisible(){return heatmapVisible;},set heatmapVisible(v){heatmapVisible=!!v;},
      get collectHeatmap(){return collectHeatmap;},set collectHeatmap(v){collectHeatmap=!!v;},
      get grid(){return grid;},message:'',radius:RADIUS};
    refreshNavigation(true);
    return api;
  }
  const exported={create,NavigationGrid,circleRect,zoneRect,CELL,RADIUS,MAX_PEOPLE,APPEARANCES};
  root.PeopleSimulation=exported;
  if(typeof module==='object'&&module.exports)module.exports=exported;
})(typeof globalThis!=='undefined'?globalThis:this);
