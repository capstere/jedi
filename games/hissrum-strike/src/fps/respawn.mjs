/** Bounded respawn selection on the existing connected floor. Static candidate
 * coordinates are cached, but occupancy and enemy sight are always live. */
export const SPAWN_CANDIDATE_LIMIT=64;
export const SPAWN_RETRY_SECONDS=.25;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const pools=new WeakMap();
function homePool(world,team,anchors,offset){
 let cache=pools.get(world);
 if(!cache||cache.nodes!==world.navigation?.nodes){cache={nodes:world.navigation?.nodes,teams:new Map()};pools.set(world,cache);}
 let nearby=cache.teams.get(team);
 if(!nearby){nearby=(world.navigation?.nodes||[]).filter(n=>anchors.some(a=>distance(a,n)<7));cache.teams.set(team,nearby);}
 const count=Math.min(Math.max(0,SPAWN_CANDIDATE_LIMIT-anchors.length),nearby.length),sample=[];
 // Even sampling covers the home region; retry offsets visit omitted nodes
 // so a free narrow passage cannot remain permanently outside the sample.
 for(let i=0;i<count;i++)sample.push(nearby[(Math.floor(i*nearby.length/count)+offset)%nearby.length]);
 return [...anchors,...sample].slice(0,SPAWN_CANDIDATE_LIMIT);
}
export function chooseRespawn(g,a,{frontline=[],control=null}={}){
 const anchors=g.world.anchors[a.team]||g.world.anchors.hostages||[];
 if(!anchors.length)return null;
 const home=anchors[(a.index||0)%anchors.length],height=g.config.standingHeight;
 const candidates=[...frontline.slice(0,32),...homePool(g.world,a.team,anchors,a.spawnRetryIndex||0)];
 const bodies=[...g.actors,...g.hostages,...(g.config.wanderers?g.state.wanderers||[]:[])].filter(o=>o!==a&&o.alive!==false&&!o.rescued);
 const enemies=bodies.filter(o=>o.team&&o.team!==a.team);
 const tank=g.state.tank;
 let best=null,bestScore=-Infinity;
 for(const p of candidates){
  // A crouched death must never permit a standing respawn inside a shelf.
  if(g.world.canOccupy&&!g.world.canOccupy(p.x,p.z,a.radius+.015,height,0))continue;
  if(tank?.alive&&distance(p,tank)<tank.radius+a.radius+.2)continue;
  if(bodies.some(o=>!o.vehicleId&&(o.y||0)<height+.12&&(o.y||0)+(o.height||1.7)>0&&distance(o,p)<(o.radius||.2)+a.radius+.12))continue;
  if(p.frontline&&enemies.some(o=>distance(o,p)<7))continue;
  let score=-distance(p,home)*.08-(control?distance(p,control)*.22:0);
  for(const e of enemies){
   const d=Math.hypot(e.x-p.x,e.y||0,e.z-p.z);
   // Distant enemies cannot contribute a sight penalty. Skip that GLB ray.
   const visible=d<18&&g.world.segmentClear({x:p.x,y:height-.12,z:p.z},
    {x:e.x,y:(e.y||0)+(e.height||1.7)-.12,z:e.z},{vision:true});
   score+=Math.min(d,22)*.025-(visible?(18-d)*1.1:0);
  }
  if(score>bestScore){best=p;bestScore=score;}
 }
 return best?{x:best.x,y:0,z:best.z,yaw:home.yaw??0}:null;
}
