/**
 * Hissrum Strike navigation — grid is derived exclusively from GLB collider clearance.
 * No invisible obstacle boxes or fabricated connecting doors.
 */
const key=(i,j)=>i+','+j;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const OFFSETS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

class MinHeap {
  constructor(){this.a=[];}
  push(n,p){const a=this.a;let i=a.length;a.push({n,p});while(i>0){const j=(i-1)>>1;if(a[j].p<=p)break;a[i]=a[j];i=j;}a[i]={n,p};}
  pop(){const a=this.a,top=a[0],end=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].p<a[c].p)c++;if(a[c].p>=end.p)break;a[i]=a[c];i=c;}a[i]=end;}return top;}
  get length(){return this.a.length;}
}

export function createNavigation(world,{spacing=1.45,maxNodes=8000}={}){
  if(!(spacing>.5&&spacing<4))throw Error('Invalid navigation spacing');
  const bounds=world.bounds,grid=new Map(),nodes=[];
  const nx=Math.floor((bounds.max.x-bounds.min.x)/spacing);
  const nz=Math.floor((bounds.max.z-bounds.min.z)/spacing);
  if(nx*nz>maxNodes*3)throw Error('Model exceeds supported navigation area');
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=bounds.min.x+(i+.5)*spacing,z=bounds.min.z+(j+.5)*spacing;
    if(world.canOccupy(x,z,.26,1.72,0)){
      const n={x,z,i,j,id:nodes.length,links:[],component:-1};
      grid.set(key(i,j),n);nodes.push(n);
    }
  }
  if(nodes.length<12)throw Error('No walkable floor found in GLB; check model axis and floor geometry');
  for(const node of nodes){
    for(const [di,dj] of OFFSETS){
      const next=grid.get(key(node.i+di,node.j+dj));if(!next)continue;
      if(di&&dj&&(!grid.has(key(node.i+di,node.j))||!grid.has(key(node.i,node.j+dj))))continue;
      if(!world.canTravel(node,next,.26,1.72))continue;
      node.links.push(next.id);
    }
  }
  let components=0;const counts=[];
  for(const node of nodes){
    if(node.component!==-1)continue;
    const queue=[node];node.component=components;let size=0;
    for(let at=0;at<queue.length;at++){
      const curr=queue[at];size++;
      for(const id of curr.links){const next=nodes[id];if(next.component<0){next.component=components;queue.push(next);}}
    }
    counts.push(size);components++;
  }
  const largest=counts.indexOf(Math.max(...counts));
  const active=nodes.filter(n=>n.component===largest);
  if(active.length<10)throw Error('No connected playable floor found');
  const activeSet=new Set(active.map(n=>n.id));

  function nearest(point){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return null;
    const ci=Math.floor((point.x-bounds.min.x)/spacing);
    const cj=Math.floor((point.z-bounds.min.z)/spacing);
    let best=null,d2=Infinity;
    for(let radius=0;radius<=5;radius++){
      for(let dj=-radius;dj<=radius;dj++)for(let di=-radius;di<=radius;di++){
        if(radius>0&&Math.abs(di)!==radius&&Math.abs(dj)!==radius)continue;
        const n=grid.get(key(ci+di,cj+dj));
        if(!n||!activeSet.has(n.id))continue;
        const d=(n.x-point.x)**2+(n.z-point.z)**2;
        if(d<d2){d2=d;best=n;}
      }
      if(best&&Math.sqrt(d2)<radius*spacing+.001)return best;
    }
    for(const n of active){const d=(n.x-point.x)**2+(n.z-point.z)**2;if(d<d2){d2=d;best=n;}}
    return best;
  }

  function findPath(start,target){
    if(!start||!target)return [];
    const a=nearest(start),b=nearest(target);if(!a||!b)return [];
    const exact=world.canOccupy(target.x,target.z,.26,1.72,0);
    const end=exact?{x:target.x,z:target.z}:b;
    if(world.canTravel(start,end,.25,1.72))return [{x:end.x,z:end.z}];
    const open=new MinHeap(),g=new Map([[a.id,0]]),prev=new Map(),closed=new Set();
    open.push(a.id,distance(a,b));let found=false;
    while(open.length){
      const {n:id}=open.pop();
      if(closed.has(id))continue;
      if(id===b.id){found=true;break;}
      closed.add(id);const curr=nodes[id];
      for(const nextId of curr.links){
        if(!activeSet.has(nextId)||closed.has(nextId))continue;
        const next=nodes[nextId],tentative=g.get(id)+distance(curr,next);
        if(tentative>=(g.get(nextId)??Infinity))continue;
        g.set(nextId,tentative);prev.set(nextId,id);
        open.push(nextId,tentative+distance(next,b));
      }
    }
    if(!found)return [];
    const chain=[b];let id=b.id;
    while(id!==a.id){id=prev.get(id);if(id===undefined)return [];chain.push(nodes[id]);}
    chain.reverse();
    // Greedy string-pulling. Every shortcut is validated with the same
    // swept capsule used for human/bot movement.
    const route=[],points=[start,...chain.slice(1),end];let at=0;
    while(at<points.length-1){
      let furthest=Math.min(points.length-1,at+1);
      for(let j=furthest+1;j<Math.min(points.length,at+15);j++){
        if(world.canTravel(points[at],points[j],.25,1.72))furthest=j;
        else break;
      }
      if(furthest===at)break;
      const p=points[furthest];route.push({x:p.x,z:p.z});at=furthest;
    }
    return route;
  }
  return {nodes:active,grid,spacing,nearest,findPath,statistics:{sampled:nodes.length,connected:active.length,components}};
}

export function selectAnchors(navigation,bounds,featureTarget=null){
  const nodes=navigation.nodes;
  if(!nodes?.length)throw Error('Connected playable room has no walkable nodes');
  const center={x:(bounds.min.x+bounds.max.x)/2,
    z:(bounds.min.z+bounds.max.z)/2};
  const w=bounds.max.x-bounds.min.x,d=bounds.max.z-bounds.min.z;
  const focal=featureTarget||center;
  const face=p=>({x:p.x,z:p.z,y:0,
    yaw:Math.atan2(p.x-focal.x,p.z-focal.z)});
  const nearest=(p,rest,clearance=2.5)=>{
    const candidates=nodes.filter(n=>rest.every(q=>distance(n,q)>=clearance));
    const best=(candidates.length?candidates:nodes)
      .sort((a,b)=>distance(a,p)-distance(b,p))[0];
    return face(best);
  };

  // A broad team zone, not a cluster at its original spawnpoint.
  // Both teams start on different sides of the real 45x45 model; in a smaller
  // fixture we use the same proportional split, never artificial rooms.
  const teamZones=[
    n=>n.z>=center.z-d*.14,
    n=>n.z<=center.z+d*.14
  ];
  const nearPlayer={x:center.x+w*.13,z:center.z+d*.22};
  const farEnemy={x:center.x-w*.28,z:center.z-d*.22};
  const within=Math.max(2.8,Math.min(6.25,Math.min(w,d)*.23));
  function distribute(target,count,avoid=[],zone,clearPlayer=false){
    const eligible=nodes.filter(zone),candidates=eligible.length>=count*6?eligible:nodes;
    const chosen=[],block=[...avoid];
    // Player/first enemy should begin at recognizable positions. Remaining
    // spawn candidates use max-min spacing, not nearest first, to spread out.
    const lead=nearest(target,block,within*.75);chosen.push(lead);
    while(chosen.length<count){
      let best=null,bestScore=-Infinity;
      const phases=[within,within*.83,within*.66,2.0,0];
      for(const spacing of phases){
        for(const p of candidates){
          const dGroup=Math.min(...chosen.map(q=>distance(p,q)));
          const dOther=avoid.length?Math.min(...avoid.map(q=>distance(p,q))):Infinity;
          if(dGroup<spacing || dOther<Math.max(1.8,spacing*.67))continue;
          if(clearPlayer){
            const v=chosen[0],fx=-Math.sin(v.yaw),fz=-Math.cos(v.yaw);
            const inFront=(p.x-v.x)*fx+(p.z-v.z)*fz;
            if(inFront>-.65&&distance(p,v)<10)continue;
          }
          const region=Math.max(0,distance(p,target)-Math.min(w,d)*.75);
          const edgeBias=.10*Math.min(
            p.x-bounds.min.x,bounds.max.x-p.x,
            p.z-bounds.min.z,bounds.max.z-p.z);
          const score=Math.min(dGroup,15)*2.0-
            .12*distance(p,target)-
            (dOther<Infinity?Math.max(0,8-dOther)*.7:0)-
            .08*region+edgeBias;
          if(score>bestScore){bestScore=score;best=p;}
        }
        if(best)break;
      }
      if(!best)throw Error('Not enough real collision-tested Hissrum 12 spawn positions');
      chosen.push(face(best));block.push(chosen.at(-1));
    }
    return chosen;
  }
  const analysts=distribute(nearPlayer,5,[],teamZones[0],true);
  const counterAnalysts=distribute(farEnemy,5,analysts,teamZones[1]);
  const avoid=[...analysts,...counterAnalysts];
  const bomb=nearest({x:center.x+w*.19,z:center.z-d*.13},avoid,2.2);
  const hostages=[
    nearest({x:center.x-w*.14,z:center.z+d*.09},[...avoid,bomb],2.0),
  ];
  hostages.push(nearest({x:center.x-w*.19,z:center.z+d*.22},
    [...avoid,bomb,...hostages],2.0));
  const rescue={...analysts[0],radius:2.1};
  // Every point was sourced from the same connected, real model floor.
  // Recheck global uniqueness to prevent actor-actor collisions at round start.
  const spawns=[...analysts,...counterAnalysts];
  if(spawns.some((a,i)=>spawns.slice(i+1).some(b=>distance(a,b)<1.8)))
    throw Error('Unsafe overlap in Hissrum 12 spawn selection');
  return {analysts,counterAnalysts,bomb:{...bomb,radius:1.7},hostages,rescue};
}
