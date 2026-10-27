/** Pooled, mobile-sized HUD inspired by Riposte; all stats come from Game.
 * Allied markers reveal no enemies; visibility checks are capped at 150 ms.
 */
import * as THREE from 'three';
import {CombatFeedback,relativeDamageAngle,reloadReadout,scoreboardRows,eligibleAlly} from './fps/combat-readability.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const text=(el,value)=>{const s=String(value);if(el.textContent!==s)el.textContent=s;};
export class CombatHUD {
 constructor(doc){
   this.doc=doc;this.feedback=new CombatFeedback();this.markers=new Map();
   this.head=new THREE.Vector3();this.projection=new THREE.Vector3();
   this.hit=doc.getElementById('hit');this.label=doc.getElementById('combat-hit-label');
   this.medal=doc.getElementById('combat-medal');this.title=doc.getElementById('medal-title');
   this.detail=doc.getElementById('medal-detail');this.points=doc.getElementById('medal-points');
   this.allies=doc.getElementById('ally-marks');this.compass=doc.getElementById('damage-compass');
   this.ticks=Array.from(this.compass.children);this.reload=doc.getElementById('reload-meter');
   this.meter=this.reload.firstElementChild;
 }
 reset(){this.feedback.reset();this.hide();for(const m of this.markers.values())m.next=0;}
 hide(){
   for(const el of [this.label,this.medal,this.allies,this.compass,this.reload])el.hidden=true;
   this.hit.style.opacity='0';this.doc.body.classList.remove('combat-medal-visible');
 }
 handle(events,game){this.feedback.handle(events,game);}
 update(game,camera,{enabled=true,markers=true,feedback=true,scope=false,weapon=null}={}){
   if(!game||!enabled){this.hide();return;}
   const time=game.state.time,p=game.player;this.feedback.tick(time);
   const h=feedback&&p?.alive?this.feedback.hit:null;
   this.hit.dataset.kind=h?.kind||'body';this.hit.style.opacity=h?'1':'0';
   this.label.hidden=!h;if(h)text(this.label,h.label);
   const medal=feedback?this.feedback.medal:null;
   this.medal.hidden=!medal;this.doc.body.classList.toggle('combat-medal-visible',!!medal);
   if(medal){text(this.title,medal.title);text(this.detail,medal.detail);text(this.points,'+'+medal.points+' POÄNG');this.medal.dataset.kind=medal.kind;}
   const dirs=feedback&&p?.alive?this.feedback.directions:[];
   this.compass.hidden=!dirs.length;
   for(let i=0;i<this.ticks.length;i++){
     const el=this.ticks[i],d=dirs[i];el.hidden=!d;
     if(d){const angle=relativeDamageAngle(p,d,camera.rotation.y);el.hidden=angle===null;
       if(angle!==null){el.style.transform=`translate(-50%,-50%) rotate(${angle}rad)`;
         el.style.opacity=String(clamp((d.until-time)/.5,0,1));}}
   }
   const r=reloadReadout(p,weapon,game.item(p),time);
   this.reload.hidden=!r.active;this.doc.querySelector('.weapon-block').classList.toggle('low-ammo',r.low);
   if(r.active){this.meter.style.transform=`scaleX(${r.progress})`;
     this.reload.setAttribute('aria-valuenow',String(Math.round(r.progress*100)));}
   if(r.low)text(this.doc.getElementById('reload-hint'),'LÅG AMMO · LADDA / R');
   else if(r.active)text(this.doc.getElementById('reload-hint'),'LADDAR · '+r.remaining.toFixed(1)+' s');
   this.updateAllies(game,camera,markers&&!scope&&!!p?.alive,time);
 }
 updateAllies(game,camera,enabled,time){
   this.allies.hidden=!enabled;if(!enabled)return;
   const p=game.player,active=new Set();camera.updateMatrixWorld();
   const w=this.doc.documentElement.clientWidth,h=this.doc.documentElement.clientHeight;
   for(const a of game.actors){
     if(!eligibleAlly(a,p))continue;
     active.add(a.id);let m=this.markers.get(a.id);
     if(!m){const el=this.doc.createElement('div');el.className='ally-marker';
       const name=this.doc.createElement('span'),chevron=this.doc.createElement('i');el.append(name,chevron);
       this.allies.append(el);m={el,name,next:-Infinity,visible:false};this.markers.set(a.id,m);}
     this.head.set(a.x,(a.y||0)+(a.height||1.7)+.28,a.z);
     const d=this.head.distanceTo(camera.position);this.projection.copy(this.head).project(camera);
     if(d<1.2||d>65||this.projection.z<-1||this.projection.z>1||Math.abs(this.projection.x)>.98||Math.abs(this.projection.y)>.94){m.el.hidden=true;continue;}
     if(time>=m.next){
       m.next=time+.15;
       m.visible=game.canSee(camera.position,this.head,true)||
         game.canSee(camera.position,{x:a.x,y:(a.y||0)+(a.height||1.7)*.6,z:a.z},true);
     }
     m.el.hidden=false;text(m.name,a.name);
     m.name.hidden=d>22;
     const scale=clamp(1-(d-8)/70,.65,1);
     m.el.style.transform=`translate(${Math.round((this.projection.x*.5+.5)*w)}px,${Math.round((-.5*this.projection.y+.5)*h)}px) translate(-50%,-100%) scale(${scale})`;
     m.el.style.opacity=String((m.visible?.9:.35)*clamp((d-1.2)/1.8,0,1));
     m.el.dataset.occluded=String(!m.visible);
   }
   for(const [id,m] of this.markers)if(!active.has(id))m.el.hidden=true;
 }
 renderScoreboard(game){
   const rows=scoreboardRows(game),body=this.doc.getElementById('scoreboard-rows');body.replaceChildren();
   let team='';
   for(const row of rows){
     if(row.team!==team){team=row.team;const tr=this.doc.createElement('tr'),th=this.doc.createElement('th');th.colSpan=5;
       th.scope='rowgroup';th.textContent=team==='analysts'?'ANALYSTS':'COUNTER ANALYSTS';tr.className='score-team '+team;tr.append(th);body.append(tr);}
     const tr=this.doc.createElement('tr');tr.dataset.actor=row.id;
     tr.classList.toggle('is-player',row.player);tr.classList.toggle('is-dead',!row.alive);
     const vals=[row.name+(row.player?' · DU':''),row.kills,row.deaths,row.assists,row.points];
     for(const [i,v] of vals.entries()){const cell=this.doc.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=String(v);tr.append(cell);}
     body.append(tr);
   }
   const mine=rows.find(r=>r.player);
   text(this.doc.getElementById('scoreboard-summary'),mine?
     `DIN MATCH · ${mine.damage} SKADA · BÄSTA SVIT ${mine.best} · ${mine.assists} ASSIST`:'');
   return rows;
 }
 diagnostics(){return {markerCount:this.markers.size,visibleMarkers:[...this.markers.values()].filter(m=>!m.el.hidden&&!this.allies.hidden).length,
   markerIds:[...this.markers.keys()],hitKind:this.feedback.hit?.kind??null,damageDirections:this.feedback.directions.length,
   medalTitle:this.feedback.medal?.title??null,scoreRows:this.doc.querySelectorAll('#scoreboard-rows tr[data-actor]').length};}
}
