/* Layout Studio V4. Pure scene data and placement helpers; V3 remains unchanged.
 * Coordinates are metres. Attached objects retain world coordinates in JSON:
 * parentId identifies the moving assembly, surfaceId identifies its support.
 */
(function(root){'use strict';
const C=root.LayoutCore;
if(!C)throw Error('Ladda planner-core.js före studio-core.js.');
const validateV3=C.validate, FLOOR=.006, FORMAT='hissrum12-v4-layout';
const TAPE_LIMIT=512, TAPE_POINT_LIMIT=128, TAPE_STYLES=['yellow','black','red','green','blue','white','yellow-black','red-white'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const text=(v,fallback,max=80)=>String(v==null?fallback:v).slice(0,max);
const baseY=o=>finite(o.y)?o.y:FLOOR;
const clone=C.clone;
function number(v,fallback,min,max){if(v===undefined)return fallback;if(!finite(v)||v<min||v>max)throw Error('Ogiltigt eller orimligt siffervärde.');return v;}
function safeId(v,fallback){const s=text(v,fallback,80);if(!s)throw Error('Ett ID får inte vara tomt.');return s;}
function localPoint(parent,x,z){const a=parent.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=x-parent.x,dz=z-parent.z;return [c*dx+s*dz,-s*dx+c*dz];}
function worldPoint(parent,x,z){const a=parent.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [parent.x+x*c-z*s,parent.z+x*s+z*c];}
function cleanParams(o){
 const p=o.params||{},out={};
 if(typeof p!=='object'||Array.isArray(p))throw Error('Ogiltiga objektparametrar.');
 if(o.type==='creformBuilder'||o.type==='creformCart'){
  out.levels=Math.round(number(p.levels,o.type==='creformCart'?2:3,1,6));
  out.pipeDiameter=number(p.pipeDiameter,.028,.02,.05);
  out.wheels=number(p.wheels,4,0,4);if(![0,4].includes(out.wheels))throw Error('Välj noll eller fyra hjul.');
  out.brakes=Math.round(number(p.brakes,2,0,out.wheels));
 }
 if(o.type==='phoneArm'){out.reach=number(p.reach,.25,.08,.7);out.direction=number(p.direction,0,-65,65);}
 if(o.type==='nitrogenTank')out.stand=p.stand!==false;
 if(o.type==='carton')out.open=!!p.open;
 if(o.type==='gloveHolder')out.color=['blue','purple','green','black'].includes(p.color)?p.color:'blue';
 if(o.type==='sign')out.text=text(p.text,o.label||'IPT SAMPLE POINTS',100);
 return out;
}
function validateObjects(list){
 if(!Array.isArray(list)||list.length>C.LIMIT)throw Error('Högst '+C.LIMIT+' möbelobjekt tillåts.');
 const ids=new Set();
 const objects=list.map((o,i)=>{
  if(!o||typeof o!=='object'||!C.byType[o.type])throw Error('Okänd objekttyp i objekt '+(i+1)+'.');
  const id=safeId(o.id,'obj-'+i);if(ids.has(id))throw Error('Dubbla objekt-ID i filen.');ids.add(id);
  for(const k of ['x','z','w','d','h','rot'])if(!finite(o[k]))throw Error('Ogiltigt siffervärde i objekt '+(i+1)+'.');
  if(o.w<.01||o.w>5||o.d<.01||o.d>5||o.h<.01||o.h>4||Math.abs(o.x)>15||Math.abs(o.z)>15||Math.abs(o.rot)>360000)throw Error('Orimliga mått eller koordinater.');
  const item={id,type:o.type,name:text(o.name,C.byType[o.type].name,60),x:o.x,y:number(o.y,FLOOR,0,4),z:o.z,w:o.w,d:o.d,h:o.h,rot:C.angle(o.rot),locked:!!o.locked};
  if(o.parentId!=null)item.parentId=safeId(o.parentId,'');
  if(o.surfaceId!=null)item.surfaceId=safeId(o.surfaceId,'');
  if(o.groupId!=null)item.groupId=safeId(o.groupId,'');
  if(o.label!=null)item.label=text(o.label,'',100);
  if(o.params!=null||['creformCart','creformBuilder'].includes(o.type))item.params=cleanParams(o);
  if(o.mount!=null){
   if(typeof o.mount!=='object'||o.mount.type!=='wall'||!['north','south','west','east'].includes(o.mount.side))throw Error('Ogiltigt väggfäste.');
   item.mount={type:'wall',side:o.mount.side,height:item.y};
   if(item.parentId)throw Error('Ett objekt kan inte samtidigt ha väggfäste och förälder.');
  }
  return item;
 });
 const byId=new Map(objects.map(o=>[o.id,o]));
 for(const o of objects){
  const seen=new Set([o.id]);let p=o;
  while(p.parentId){if(!byId.has(p.parentId))throw Error('Föräldraobjekt saknas.');if(seen.has(p.parentId))throw Error('Cirkulär objektgrupp är inte tillåten.');seen.add(p.parentId);p=byId.get(p.parentId);}
  if(o.parentId){const parent=byId.get(o.parentId);if(!o.surfaceId||!surfaces(parent).some(s=>s.id===o.surfaceId))throw Error('Stödytan saknas på föräldraobjektet.');}
 }
 return objects;
}
function validateTapes(input=[]){
 if(!Array.isArray(input)||input.length>TAPE_LIMIT)throw Error('Högst '+TAPE_LIMIT+' tejpmarkeringar tillåts.');
 const ids=new Set();let segments=0;
 return input.map((t,i)=>{
  if(!t||!Array.isArray(t.points)||t.points.length<2||t.points.length>TAPE_POINT_LIMIT)throw Error('Tejp behöver 2–'+TAPE_POINT_LIMIT+' punkter.');
  segments+=t.points.length-1;if(segments>TAPE_LIMIT)throw Error('Högst '+TAPE_LIMIT+' tejpsegment tillåts.');
  const id=safeId(t.id,'tape-'+i);if(ids.has(id))throw Error('Dubbla tejp-ID.');ids.add(id);
  const points=t.points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>!finite(n)||Math.abs(n)>15))throw Error('Ogiltig tejppunkt.');return p.slice();});
  const style=t.style||t.type||'yellow';if(!TAPE_STYLES.includes(style))throw Error('Okänd tejptyp.');
  return {id,name:text(t.name,'Golvtejp '+(i+1),60),style,width:number(t.width,.05,.01,.2),dashed:!!t.dashed,points};
 });
}
function validateKeepClear(input=[]){
 if(!Array.isArray(input)||input.length>32)throw Error('Högst 32 fria ytor tillåts.');
 const ids=new Set();
 return input.map((z,i)=>{
  if(!z||typeof z!=='object')throw Error('Ogiltig fri yta.');
  const id=safeId(z.id,'clear-'+i);if(ids.has(id))throw Error('Dubbla ID för fria ytor.');ids.add(id);
  return {id,name:text(z.name,'Fri passage',60),x:number(z.x,0,-15,15),z:number(z.z,0,-15,15),w:number(z.w,1,.05,10),d:number(z.d,1,.05,10),rot:C.angle(number(z.rot,0,-360000,360000)),clearance:number(z.clearance,0,0,3)};
 });
}
function validateDoor(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ogiltig dörrinställning.');
 const result={angle:number(input.angle,0,0,90),direction:input.direction===undefined?1:input.direction};
 if(![-1,1].includes(result.direction))throw Error('Dörrriktningen ska vara −1 eller 1.');
 return result;
}
function validateAnnotations(input,info){
 const valid=p=>Array.isArray(p)&&p.length===3&&p.every(finite)&&p[0]>=info.bounds.west-.01&&p[0]<=info.bounds.east+.01&&p[2]>=info.bounds.north-.01&&p[2]<=info.bounds.south+.01&&p[1]>=0&&p[1]<=4;
 const measures=input.measures||[],zones=input.zones||[];
 if(!Array.isArray(measures)||!Array.isArray(zones)||measures.length>40||zones.length>32||[...measures,...zones].some(o=>!o||!valid(o.a)||!valid(o.b)))throw Error('Ogiltiga mått eller ytmarkeringar.');
 return {measures:measures.map(o=>({a:o.a.slice(),b:o.b.slice()})),zones:zones.map((o,i)=>({a:[o.a[0],.028,o.a[2]],b:[o.b[0],.028,o.b[2]],name:text(o.name,'Yta '+(i+1),40)}))};
}
function preferences(p={}){
 if(!p||typeof p!=='object'||Array.isArray(p))p={};
 return {grid:[0,.01,.05,.1].includes(p.grid)?p.grid:.05,wallSnap:p.wallSnap!==false,showDoors:p.showDoors!==false,doorDepth:finite(p.doorDepth)?clamp(p.doorDepth,.2,3):1,objectSnap:p.objectSnap!==false};
}
function validate(input,info){
 if(!input||typeof input!=='object')throw Error('Filen saknar layoutdata.');
 if(input.format==='hissrum12-v3-layout'||input.format==='hissrum12-v2-annotations'){
  const old=validateV3(input,info);
  return {...old,objects:(old.objects||[]).map(o=>({...o,y:FLOOR})),tapes:[],keepClear:[],door:{angle:0,direction:1},variants:[],version:4,migratedFrom:input.format,preferences:preferences(old.preferences)};
 }
 if(input.format!==FORMAT||input.model!==C.MODEL||(input.version!==undefined&&input.version!==4))throw Error('Filen hör inte till den här V4-modellen.');
 const result={objects:validateObjects(input.objects),...validateAnnotations(input,info),tapes:validateTapes(input.tapes),keepClear:validateKeepClear(input.keepClear),door:validateDoor(input.door),preferences:preferences(input.preferences),name:text(input.name,'Importerad layout',60),version:4};
 const variants=input.variants||[],variantIds=new Set();if(!Array.isArray(variants)||variants.length>2)throw Error('Högst två jämförelselayouter tillåts.');
 result.variants=variants.map(v=>{
  if(!v||typeof v!=='object'||!['A','B'].includes(v.id)||variantIds.has(v.id)||!v.data||typeof v.data!=='object')throw Error('Ogiltig jämförelselayout.');
  variantIds.add(v.id);const d=v.data;
  if(d.format!==FORMAT||d.model!==C.MODEL||(d.version!==undefined&&d.version!==4))throw Error('Jämförelselayouten hör inte till den här V4-modellen.');
  return {id:v.id,data:{format:FORMAT,version:4,model:C.MODEL,name:text(d.name,'Layout '+v.id,60),objects:validateObjects(d.objects||[]),tapes:validateTapes(d.tapes),keepClear:validateKeepClear(d.keepClear),door:validateDoor(d.door),preferences:preferences(d.preferences),...validateAnnotations(d,info),variants:[]}};
 });
 return result;
}
function createLayout(state={}){
 return {format:FORMAT,version:4,model:C.MODEL,name:state.name||'Min layout',objects:clone(state.objects||[]),measures:clone(state.measures||[]),zones:clone(state.zones||[]),tapes:clone(state.tapes||[]),keepClear:clone(state.keepClear||[]),door:clone(state.door||{angle:0,direction:1}),preferences:clone(state.preferences||{}),variants:clone(state.variants||[])};
}
function surfaces(o){
 if(!o)return [];
 const y=baseY(o);let list=[];
 const surface=(id,name,height,w,d,clearance=4)=>({id,name,x:o.x,z:o.z,y:y+height,w:Math.max(.001,w),d:Math.max(.001,d),rot:o.rot,clearance,parentId:o.id});
 if(o.type==='creformCart'||o.type==='creformBuilder'){
  const spec=C.creformSpec?C.creformSpec(o):{innerW:o.w-.07,innerD:o.d-.07,heights:o.type==='creformCart'?[.22,.72]:[.22,(o.h-.01)/2,o.h-.23]};
  list=spec.heights.map((h,i)=>surface('shelf-'+i,'Hyllplan '+(i+1),h,spec.innerW,spec.innerD,i<spec.heights.length-1?spec.heights[i+1]-h-(spec.diameter||.028):o.h-h));
 }else if(o.type==='cart'){
  const hs=[.197,.627,1.037].map(h=>h*o.h/1.15);list=hs.map((h,i)=>surface('shelf-'+i,'Hyllplan '+(i+1),h,o.w*.84,o.d*.415/.55,i<2?hs[i+1]-h-.05:4));
 }else if(o.type==='shelf'){
  const hs=[.0925,.6425,1.1925,1.7425].map(h=>h*o.h/1.8);list=hs.map((h,i)=>surface('shelf-'+i,'Hyllplan '+(i+1),h,o.w*.935,o.d*.405/.45,i<3?hs[i+1]-h-.04:4));
 }else if(['boxSmall','boxLarge','plasticBoxSmall','plasticBoxLarge'].includes(o.type)){
  list=[surface('inside','Lådans botten',.007, o.w-.016,o.d-.016,4)];
 }else if(['pallet','material','fridge','carton'].includes(o.type)){
  if(o.type==='carton'&&o.params?.open)list=[surface('inside','Kartongens botten',.006,o.w-.014,o.d-.014,4)];
  else list=[surface('top','Ovansida',o.h,o.w-.01,o.d-.01,4)];
 }
 return list;
}
function attachToSurface(child,parent,surfaceId,objects=[]){
 const surface=surfaces(parent).find(s=>s.id===surfaceId);
 if(!surface)return {object:clone(child),fit:false,warning:'Välj en stöd-/hyllnivå som finns.'};
 if(child.id===parent.id||descendantIds(objects,child.id).includes(parent.id))return {object:clone(child),fit:false,warning:'Ett objekt kan inte placeras på sin egen undergrupp.'};
 const rot=C.angle(child.rot-parent.rot),a=rot*Math.PI/180,ex=(Math.abs(Math.cos(a))*child.w+Math.abs(Math.sin(a))*child.d)/2,ez=(Math.abs(Math.sin(a))*child.w+Math.abs(Math.cos(a))*child.d)/2;
 if(ex*2>surface.w+.001||ez*2>surface.d+.001||child.h>surface.clearance+.003)return {object:clone(child),fit:false,warning:'Objektet ryms inte på den valda stödytan. Prova att rotera eller ändra mått.'};
 const [u,v]=localPoint(parent,child.x,child.z),[x,z]=worldPoint(parent,clamp(u,-surface.w/2+ex,surface.w/2-ex),clamp(v,-surface.d/2+ez,surface.d/2-ez));
 const object={...clone(child),x,z,y:surface.y,parentId:parent.id,surfaceId:surface.id};delete object.mount;
 const conflicts=objects.filter(o=>o.id!==child.id&&o.parentId===parent.id&&o.surfaceId===surface.id&&verticalOverlap(object,o)&&C.overlap(object,o));
 return {object,fit:true,warning:conflicts.length?'Objektet överlappar ett annat föremål på samma stöd.':null};
}
function descendantIds(objects,id){
 const out=[],seen=new Set([id]);let frontier=[id];
 while(frontier.length){const parents=new Set(frontier);frontier=[];for(const o of objects)if(o.parentId&&parents.has(o.parentId)&&!seen.has(o.id)){seen.add(o.id);out.push(o.id);frontier.push(o.id);}}
 return out;
}
function moveHierarchy(objects,id,patch){
 const original=objects.find(o=>o.id===id);if(!original)return clone(objects);
 const next={...clone(original),...clone(patch)};next.rot=C.angle(next.rot);
 if(patch.parentId){delete next.mount;}else if(patch.parentId===null){delete next.parentId;delete next.surfaceId;}
 if(patch.mount){delete next.parentId;delete next.surfaceId;}else if(patch.mount===null)delete next.mount;
 const descendants=new Set(descendantIds(objects,id)),a=(next.rot-original.rot)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dy=baseY(next)-baseY(original);
 const result=objects.map(o=>{
  if(o.id===id)return next;if(!descendants.has(o.id))return clone(o);
  const dx=o.x-original.x,dz=o.z-original.z;
  return {...clone(o),x:next.x+dx*c-dz*s,z:next.z+dx*s+dz*c,y:baseY(o)+dy,rot:C.angle(o.rot+next.rot-original.rot)};
 });
 // If a shelf changes height, retain the attachment and lift its contents with it.
 if(['w','h','d','params'].some(k=>Object.prototype.hasOwnProperty.call(patch,k))){
  for(const child of result.filter(o=>o.parentId===id)){
   const available=surfaces(next),surf=available.find(v=>v.id===child.surfaceId)||available.sort((a,b)=>Math.abs(a.y-baseY(child))-Math.abs(b.y-baseY(child)))[0];
   if(surf){const delta=surf.y-baseY(child),nested=new Set(descendantIds(result,child.id));child.surfaceId=surf.id;child.y=surf.y;for(const n of result)if(nested.has(n.id))n.y=baseY(n)+delta;}
   else {delete child.parentId;delete child.surfaceId;}
  }
 }
 return result;
}
function detachObject(objects,id,toFloor=false){
 const current=objects.find(o=>o.id===id);if(!current)return clone(objects);
 const moved=toFloor?moveHierarchy(objects,id,{y:FLOOR}):clone(objects);
 const target=moved.find(o=>o.id===id);delete target.parentId;delete target.surfaceId;delete target.mount;
 return moved;
}
function rootSelection(objects,ids){
 const selected=new Set(ids),byId=new Map(objects.map(o=>[o.id,o]));
 return objects.filter(o=>selected.has(o.id)&&!o.locked).filter(o=>{let p=o;const seen=new Set();while(p.parentId&&!seen.has(p.parentId)){seen.add(p.parentId);if(selected.has(p.parentId))return false;p=byId.get(p.parentId)||{};}return true;});
}
function transformSelection(objects,ids,delta={}){
 let result=clone(objects);for(const o of rootSelection(objects,ids))result=moveHierarchy(result,o.id,{x:o.x+(delta.dx||0),z:o.z+(delta.dz||0),y:baseY(o)+(delta.dy||0),rot:C.angle(o.rot+(delta.rotation||0))});return result;
}
function duplicateHierarchy(objects,ids,offset=.15){
 const roots=rootSelection(objects,ids),set=new Set(roots.flatMap(o=>[o.id,...descendantIds(objects,o.id)]));
 if(objects.length+set.size>C.LIMIT)throw Error('Högst '+C.LIMIT+' möbelobjekt tillåts.');
 const suffix=Date.now().toString(36),mapping=new Map();let counter=0;
 for(const id of set){let next;do{next='obj-'+suffix+'-'+counter++;}while(objects.some(o=>o.id===next));mapping.set(id,next);}
 const copies=objects.filter(o=>set.has(o.id)).map(o=>{const n={...clone(o),id:mapping.get(o.id),x:o.x+offset,z:o.z+offset,locked:false};if(mapping.has(o.parentId))n.parentId=mapping.get(o.parentId);else{delete n.parentId;delete n.surfaceId;}if(n.groupId)n.groupId='group-'+suffix;return n;});
 return {objects:[...clone(objects),...copies],ids:roots.map(o=>mapping.get(o.id))};
}
function snapWall(o,side,height,info){
 if(!['north','south','west','east'].includes(side))return {object:clone(o),fit:false,warning:'Välj vägg.'};
 const b=info.bounds,object={...clone(o),y:clamp(finite(height)?height:baseY(o),0,Math.max(0,(info.ceilings?.entrySide||2.53)-o.h)),rot:{north:0,south:180,west:270,east:90}[side],mount:{type:'wall',side,height}};
 object.mount.height=object.y;delete object.parentId;delete object.surfaceId;
 const extent=o.w/2,wallDepth=o.d/2+.008,horizontal=side==='north'||side==='south';
 if(horizontal){object.x=clamp(o.x,b.west+extent,b.east-extent);object.z=side==='north'?b.north+wallDepth:b.south-wallDepth;}
 else {object.z=clamp(o.z,b.north+extent,b.south-extent);object.x=side==='west'?b.west+wallDepth:b.east-wallDepth;}
 const coordinate=horizontal?object.x:object.z;
 const door=(info.doors||[]).find(d=>d.side===side&&Math.abs(coordinate-d.center)<extent+d.width/2+.02);
 if(door)return {object,fit:false,warning:'Väggplaceringen berör öppningen '+door.name+'. Välj en fri väggyta.'};
 const fixed=(info.fixedObstructions||[]).find(r=>C.overlap(object,C.rect(r)));
 if(fixed)return {object,fit:false,warning:'Väggplaceringen berör '+fixed.name.toLowerCase()+'. Välj en fri väggyta.'};
 return {object,fit:true,warning:null};
}
function snapObjects(object,objects,threshold=.08){
 let result={...object},best=threshold;const a=C.angle(object.rot);
 for(const other of objects){if(other.id===object.id||other.parentId===object.id||!verticalOverlap(object,other)||Math.abs(C.angle(other.rot)-a)>.01)continue;
  const [u,v]=localPoint(other,result.x,result.z),gapX=(other.w+object.w)/2+.01,gapZ=(other.d+object.d)/2+.01;
  for(const sign of [-1,1]){
   const dx=Math.abs(u-sign*gapX);if(dx<best&&Math.abs(v)<(other.d+object.d)/2){const [x,z]=worldPoint(other,sign*gapX,v);result={...result,x,z};best=dx;}
   const dz=Math.abs(v-sign*gapZ);if(dz<best&&Math.abs(u)<(other.w+object.w)/2){const [x,z]=worldPoint(other,u,sign*gapZ);result={...result,x,z};best=dz;}
  }
 }return result;
}
function verticalOverlap(a,b){return Math.min(baseY(a)+a.h,baseY(b)+b.h)>Math.max(baseY(a),baseY(b))+.003;}
function isAncestor(id,o,byId){const seen=new Set();while(o?.parentId&&!seen.has(o.parentId)){if(o.parentId===id)return true;seen.add(o.parentId);o=byId.get(o.parentId);}return false;}
function floorObstacle(o){return !o.parentId&&o.mount?.type!=='wall'&&baseY(o)<.2;}
function doorLeaf(info,state={angle:0,direction:1}){
 const d=(info.doors||[]).find(d=>d.name==='Hiss 12')||info.doors?.[0];
 // Same hinge and panel bounds as door.js, measured from the preserved GLB.
 if(!d)return null;const hingeX=2.44,hingeZ=-3.755,dir=state.direction===-1?-1:1,a=-dir*(state.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=-.685,dz=-.065;
 return {x:hingeX+dx*c-dz*s,z:hingeZ+dx*s+dz*c,y:0,w:1.418,d:.065,h:2.82,rot:-dir*(state.angle||0),hinge:[hingeX,hingeZ]};
}
function intersectsDoorSweep(o,info,door={angle:90,direction:1}){
 // Reject distant objects before sampling the hinge motion.
 if(Math.hypot(o.x-2.44,o.z+3.755)>1.5+Math.hypot(o.w,o.d)/2)return false;
 const angle=clamp(door.angle||0,0,90);
 for(let a=0;a<=angle+.001;a+=3){const leaf=doorLeaf(info,{...door,angle:a});if(leaf&&verticalOverlap(o,leaf)&&C.overlap(o,leaf))return true;}
 const leaf=doorLeaf(info,door);return !!leaf&&verticalOverlap(o,leaf)&&C.overlap(o,leaf);
}
function check(objects,info,depth=1,extras={}){
 extras=extras||{};
 const issues=[],b=info.bounds,byId=new Map(objects.map(o=>[o.id,o]));
 for(const o of objects){
  if(C.corners(o).some(([x,z])=>x<b.west-.003||x>b.east+.003||z<b.north-.003||z>b.south+.003))issues.push({kind:'outside',ids:[o.id],text:o.name+' går utanför rummets golvkontur.'});
  for(const r of info.fixedObstructions||[])if(C.overlap(o,C.rect(r)))issues.push({kind:'fixed',ids:[o.id],text:o.name+' överlappar '+r.name.toLowerCase()+'.'});
  if(floorObstacle(o))for(const z of C.doorZones(info,depth))if(C.overlap(o,z))issues.push({kind:'door',ids:[o.id],text:o.name+' berör den illustrativa zonen vid '+z.name+'.'});
  const ceiling=info.ceilings?.entrySide||2.53;if(baseY(o)+o.h>ceiling+.003)issues.push({kind:'height',ids:[o.id],text:o.name+' når över den lägre taknivån ('+ceiling+' m). Kontrollera exakt plats.'});
  if(o.mount?.type==='wall'){
   const mounted=snapWall(o,o.mount.side,baseY(o),info);
   if(!mounted.fit)issues.push({kind:'mount',ids:[o.id],text:o.name+': '+mounted.warning});
   else if(Math.hypot(o.x-mounted.object.x,o.z-mounted.object.z)>.025||C.angle(o.rot)!==mounted.object.rot)issues.push({kind:'mount',ids:[o.id],text:o.name+' ligger inte på den angivna väggytan. Montera om objektet.'});
  }
  if(o.parentId){
   const parent=byId.get(o.parentId),surface=parent&&surfaces(parent).find(s=>s.id===o.surfaceId);
   if(!surface)issues.push({kind:'support',ids:[o.id],text:o.name+' saknar en giltig stödyta.'});
   else {
    const frame={x:surface.x,z:surface.z,w:surface.w,d:surface.d,rot:surface.rot};
    if(Math.abs(baseY(o)-surface.y)>.008||C.corners(o).some(([x,z])=>!C.pointInside(frame,x,z,.003))||o.h>surface.clearance+.003)issues.push({kind:'support',ids:[o.id],text:o.name+' ryms inte längre på den valda stödytan.'});
   }
  }
  if(floorObstacle(o))for(const z of extras.keepClear||[]){const area={...z,w:z.w+2*(z.clearance||0),d:z.d+2*(z.clearance||0)};if(C.overlap(o,area))issues.push({kind:'keepClear',ids:[o.id],zoneId:z.id,text:o.name+' berör fri yta: '+z.name+'. Kontrollavståndet är ett planeringsantagande.'});}
  if(extras.door&&intersectsDoorSweep(o,info,extras.door))issues.push({kind:'doorSweep',ids:[o.id],text:o.name+' berör hissdörrens illustrativa svep.'});
 }
 for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
  const a=objects[i],b=objects[j];if(isAncestor(a.id,b,byId)||isAncestor(b.id,a,byId))continue;
  if(verticalOverlap(a,b)&&C.overlap(a,b))issues.push({kind:'object',ids:[a.id,b.id],text:a.name+' överlappar '+b.name+'.'});
 }
 return issues;
}
function matrix(o){
 const t=C.geometryDimensions?C.geometryDimensions(o):C.byType[o.type],r=o.rot*Math.PI/180,c=Math.cos(r),s=Math.sin(r),sx=o.w/t.w,sy=o.h/t.h,sz=o.d/t.d;
 return {model:new Float32Array([c*sx,0,s*sx,0,0,sy,0,0,-s*sz,0,c*sz,0,o.x,baseY(o),o.z,1]),normal:new Float32Array([c/sx,0,s/sx,0,1/sy,0,-s/sz,0,c/sz])};
}
function rayHit(ray,o){
 const a=o.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=ray.origin[0]-o.x,dz=ray.origin[2]-o.z,d=ray.dir,p=[c*dx+s*dz,ray.origin[1]-baseY(o),-s*dx+c*dz],v=[c*d[0]+s*d[2],d[1],-s*d[0]+c*d[2]],lo=[-o.w/2,0,-o.d/2],hi=[o.w/2,o.h,o.d/2];let near=0,far=Infinity;
 for(let i=0;i<3;i++){if(Math.abs(v[i])<1e-8){if(p[i]<lo[i]||p[i]>hi[i])return null;}else{const t1=(lo[i]-p[i])/v[i],t2=(hi[i]-p[i])/v[i];near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)return null;}}return far>=0?near:null;
}
function raySurface(ray,surface){
 if(Math.abs(ray.dir[1])<1e-8)return null;const distance=(surface.y-ray.origin[1])/ray.dir[1];if(distance<0)return null;
 const x=ray.origin[0]+distance*ray.dir[0],z=ray.origin[2]+distance*ray.dir[2];return C.pointInside(surface,x,z)?{distance,x,y:surface.y,z,surface}:null;
}
function nearestSupport(ray,objects,excludeId){
 const excluded=new Set([excludeId,...descendantIds(objects,excludeId)]);let best=null;
 for(const o of objects)if(!excluded.has(o.id))for(const s of surfaces(o)){const hit=raySurface(ray,s);if(hit&&(!best||hit.distance<best.distance))best={...hit,parent:o};}
 return best;
}
function tapeLength(tape){return tape.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-tape.points[i][0],p[1]-tape.points[i][1]),0);}
function tapeEnclosedArea(tape){
 const points=tape.points;if(points.length<4||Math.hypot(points[0][0]-points[points.length-1][0],points[0][1]-points[points.length-1][1])>.001)return 0;
 return Math.abs(points.slice(1).reduce((sum,p,i)=>sum+points[i][0]*p[1]-p[0]*points[i][1],0))/2;
}
function layoutStats(state,info){
 return {objects:(state.objects||[]).length,pallets:(state.objects||[]).filter(o=>['pallet','palletBins','material'].includes(o.type)).length,tapeMetres:(state.tapes||[]).reduce((sum,t)=>sum+tapeLength(t),0),markedArea:(state.zones||[]).reduce((sum,z)=>sum+Math.abs((z.a[0]-z.b[0])*(z.a[2]-z.b[2])),0)+(state.keepClear||[]).reduce((sum,z)=>sum+z.w*z.d,0)+(state.tapes||[]).reduce((sum,t)=>sum+tapeEnclosedArea(t),0),warnings:check(state.objects||[],info,state.preferences?.doorDepth||1,state).length};
}
Object.assign(C,{FORMAT,VERSION:4,FLOOR,TAPE_LIMIT,TAPE_POINT_LIMIT,TAPE_STYLES,baseY,validate,validateObjects,validateTapes,validateKeepClear,validateDoor,createLayout,surfaces,localPoint,worldPoint,attachToSurface,descendantIds,moveHierarchy,detachObject,rootSelection,transformSelection,duplicateHierarchy,snapWall,snapObjects,verticalOverlap,doorLeaf,intersectsDoorSweep,check,matrix,rayHit,raySurface,nearestSupport,tapeLength,tapeEnclosedArea,layoutStats});
if(typeof module==='object'&&module.exports)module.exports=C;
})(typeof globalThis!=='undefined'?globalThis:this);
