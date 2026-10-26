/* Thin, local floor meshes. Tape never consumes a furniture slot or obstructs a passage. */
(function(C){'use strict';
const colors={yellow:[.98,.77,.08,1],black:[.065,.08,.08,1],red:[.84,.15,.12,1],green:[.12,.53,.31,1],blue:[.12,.39,.76,1],white:[.96,.96,.91,1]};
for(const [name,rgb]of Object.entries(colors))C.MATS['floorTape_'+name]=rgb;
function clip(poly,fn,level,keepAbove){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],va=fn(a)-level,vb=fn(b)-level,ia=keepAbove?va>=0:va<=0,ib=keepAbove?vb>=0:vb<=0;if(ia)out.push(a);if(ia!==ib){const t=va/(va-vb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
C.buildTapeGeometry=function(tape){const batches=new Map();function polygon(points,color,a,ux,uz){if(points.length<3)return;const mat='floorTape_'+color;if(!batches.has(mat))batches.set(mat,{mat,p:[],n:[],uv:[]});const b=batches.get(mat),v=points.map(([t,q])=>[a[0]+ux*t-uz*q,.012,a[1]+uz*t+ux*q]);for(let i=1;i<v.length-1;i++){b.p.push(...v[0],...v[i+1],...v[i]);b.n.push(0,1,0,0,1,0,0,1,0);b.uv.push(0,0,1,1,1,0);}}
for(let i=1;i<tape.points.length;i++){const a=tape.points[i-1],z=tape.points[i],length=Math.hypot(z[0]-a[0],z[1]-a[1]);if(length<.001)continue;const ux=(z[0]-a[0])/length,uz=(z[1]-a[1])/length,w=tape.width/2,palette=(tape.style||'yellow').split('-'),step=tape.dashed?.34:length;
for(let from=0;from<length;from+=step){const to=Math.min(length,from+(tape.dashed?.22:length)),rect=[[from,-w],[to,-w],[to,w],[from,w]];if(palette.length===1)polygon(rect,palette[0],a,ux,uz);else{const stripe=Math.max(.04,tape.width*1.5),fn=p=>p[0]+p[1];for(let k=Math.floor((from-w)/stripe);k<=Math.ceil((to+w)/stripe);k++){let p=clip(clip(rect,fn,k*stripe,true),fn,(k+1)*stripe,false);polygon(p,palette[((k%2)+2)%2],a,ux,uz);}}}}
return [...batches.values()].map(b=>({...b,p:new Float32Array(b.p),n:new Float32Array(b.n),uv:new Float32Array(b.uv)}));};
C.tapeArea=tapes=>tapes.reduce((sum,t)=>sum+t.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-t.points[i][0],p[1]-t.points[i][1])*t.width,0),0);
})(globalThis.LayoutCore);
