/** Original, local PBR finishes for the authored first-person hands.
 * No external images, canvas, runtime fetch, shader patch or random source.
 * Glove UV: dorsal/palmar halves; x=[-.055,.055], y=[-.102,.148] metres.
 * The caller caches the returned pair and owns every GPU resource via own().
 */
import * as T from 'three';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const gauss=x=>Math.exp(-(x*x));
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);};
const panel=[[-.018,-.058],[-.028,-.040],[-.027,.007],[-.017,.020],[.017,.018],[.027,.003],[.025,-.038],[.014,-.058]];
const edge={distance:0,along:0,inside:false};
function panelEdge(x,y){
 let distance=Infinity,along=0,walk=0,inside=false;
 for(let i=0,j=panel.length-1;i<panel.length;j=i++){
  const a=panel[j],b=panel[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(length*length));
  const d=Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);if(d<distance){distance=d;along=walk+t*length;}walk+=length;
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 edge.distance=distance;edge.along=along;edge.inside=inside;return edge;
}
function texture(bytes,size,own,{srgb=false,repeat=false,name=''}){
 const t=own(new T.DataTexture(bytes,size,size,T.RGBAFormat));t.name=name;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
 t.wrapS=t.wrapT=repeat?T.RepeatWrapping:T.ClampToEdgeWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;
 t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;t.userData.sharedWeapon=true;return t;
}
function maps(size,own,paint,{repeat=false,name=''}){
 const rgb=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
 // One scratch sample avoids allocating objects for each texel.
 const sample={r:0,g:0,b:0,height:0,roughness:1};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  paint((x+.5)/size,(y+.5)/size,x,y,sample);const i=y*size+x,k=i*4;
  rgb[k]=clamp(Math.round(sample.r),0,255);rgb[k+1]=clamp(Math.round(sample.g),0,255);rgb[k+2]=clamp(Math.round(sample.b),0,255);rgb[k+3]=255;
  const r=Math.round(clamp(sample.roughness)*255);rough[k]=rough[k+1]=rough[k+2]=r;rough[k+3]=255;heights[i]=sample.height;
 }
 const at=(x,y)=>heights[(repeat?(y+size)%size:clamp(y,0,size-1))*size+(repeat?(x+size)%size:clamp(x,0,size-1))];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const k=(y*size+x)*4,dx=(at(x-1,y)-at(x+1,y))*4,dy=(at(x,y-1)-at(x,y+1))*4,inv=1/Math.hypot(dx,dy,1);
  normal[k]=Math.round((dx*inv*.5+.5)*255);normal[k+1]=Math.round((dy*inv*.5+.5)*255);normal[k+2]=Math.round((inv*.5+.5)*255);normal[k+3]=255;
 }
 return {map:texture(rgb,size,own,{srgb:true,repeat,name:name+'-color'}),normalMap:texture(normal,size,own,{repeat,name:name+'-normal'}),roughnessMap:texture(rough,size,own,{repeat,name:name+'-roughness'})};
}
function glovePaint(u,v,px,py,o){
 const palm=u>=.5,x=((u*2)%1)*.11-.055,y=v*.25-.102;
 const fine=noise(px*.72,py*.83)-.5,grain=noise(px*.19+7,py*.19)-.5,broad=noise(px*.035,py*.04)-.5;
 const cuff=1-ease(-.078,-.071,y),cuffRib=Math.sin(y*Math.PI*1700)*.5+.5;
 let r=palm?43:57,g=palm?49:66,b=palm?51:72,h=grain*.040+fine*.010,roughness=palm?.90:.88;
 // Broad, fitted dorsal fabric panel. The seam is shallow and continuous rather
 // than an added solid oval or isolated geometric buttons over the knuckles.
 if(!palm&&y>-.068&&y<.028&&Math.abs(x)<.036){
  const e=panelEdge(x,y),inside=e.inside?ease(0,.0012,e.distance):0;
  r=mix(r,49,inside);g=mix(g,59,inside);b=mix(b,66,inside);roughness=mix(roughness,.94,inside);
  h+=inside*.022;
  const channel=1-ease(.00025,.00115,e.distance);r-=channel*4;g-=channel*4;b-=channel*4;h-=channel*.030;
  // 2 mm stitched dash spacing, laid just inside the sewn panel edge.
  const stitchBand=1-ease(.00025,.00065,Math.abs(e.distance-.0018));
  const stitch=e.inside?stitchBand*(1-ease(.25,.48,Math.abs((e.along/.0023)%1-.5))):0;
  r+=stitch*15;g+=stitch*16;b+=stitch*16;h+=stitch*.025;
  // A few lengthwise tailoring lines follow the tendons, with no painted armor.
  for(const cx of[-.018,-.006,.007,.019]){
   const line=gauss((x-cx)/.00085)*ease(-.043,-.033,y)*(1-ease(-.001,.010,y));
   h-=line*.010;r-=line*1.4;g-=line*1.4;b-=line*1.4;
  }
 }
 if(palm){
  // Matte suede grip patch, fine stipple, and two crease families across the heel.
  const heel=(1-ease(.021,.036,Math.abs(x)))*ease(-.068,-.053,y)*(1-ease(.005,.026,y));
  const suede=(noise(px*.45+17,py*.45+19)-.5)*3;
  r+=heel*(3+suede);g+=heel*(4+suede);b+=heel*(3+suede);h+=heel*fine*.025;
  const crease1=gauss((y+.027+x*.27)/.0012)*(1-ease(.024,.037,Math.abs(x)));
  const crease2=gauss((y+.050-x*.35)/.0010)*(1-ease(.018,.034,Math.abs(x)));
  h-=(crease1+crease2)*.030;r-=(crease1+crease2)*3;g-=(crease1+crease2)*3;b-=(crease1+crease2)*3;
 }
 // Thin joint flexion marks on the fingers, not a checker pattern or round pads.
 const fingerRegion=ease(.018,.029,y)*(1-ease(.118,.140,y));
 for(const joint of[.048,.073,.096]){
  const fold=gauss((y-joint+.001*Math.sin(x*160))/.00125)*fingerRegion;
  h-=fold*(palm?.022:.015);r-=fold*2;g-=fold*2;b-=fold*2;
 }
 const worn=ease(.012,.026,y)*(1-ease(.041,.060,y))*(1-ease(.028,.043,Math.abs(x)))*.7;
 r+=worn*2+broad*3+grain*2;g+=worn*2+broad*3+grain*2;b+=worn*1.5+broad*3+grain*2;
 // Dense knit cuff has restrained ribs and a seam at the glove transition.
 r=mix(r,37+cuffRib*2,cuff);g=mix(g,46+cuffRib*2,cuff);b=mix(b,55+cuffRib*2,cuff);
 h=mix(h,cuffRib*.022+fine*.009,cuff);roughness=mix(roughness,.96,cuff);
 const cuffSeam=gauss((y+.075)/.0008);h-=cuffSeam*.025;
 o.r=r;o.g=g;o.b=b;o.height=h;o.roughness=clamp(roughness+fine*.035,.72,.99);
}
function clothPaint(u,v,px,py,o){
 // Periodic thread directions and an unobtrusive ripstop reinforcement. Material
 // color carries the navy/slate identity; no large painted shadows in the map.
 const wx=Math.sin(u*Math.PI*2*64),wy=Math.sin(v*Math.PI*2*64),weave=wx*wy;
 const reinforcementX=Math.pow(Math.max(0,Math.cos(u*Math.PI*2*8)),28),reinforcementY=Math.pow(Math.max(0,Math.cos(v*Math.PI*2*8)),28);
 const reinforcement=Math.max(reinforcementX,reinforcementY),grain=hash(px,py)-.5;
 const dye=Math.sin(u*Math.PI*2*3+Math.sin(v*Math.PI*2*2))*.65+Math.sin(v*Math.PI*2*5)*.35;
 const value=weave*.65+reinforcement*.8+grain*.65+dye;
 o.r=46+value;o.g=62+value;o.b=76+value;o.height=weave*.015+reinforcement*.011+grain*.007;o.roughness=.96+grain*.025;
}
export function createHandMaterials(own=v=>v){
 const gloveMaps=maps(512,own,glovePaint,{name:'fitted-work-glove'}),clothMaps=maps(256,own,clothPaint,{repeat:true,name:'tailored-ripstop-sleeve'});
 const glove=own(new T.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:1,...gloveMaps,normalScale:new T.Vector2(.32,.32),envMapIntensity:.6}));
 const cloth=own(new T.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:1,...clothMaps,normalScale:new T.Vector2(.22,.22),envMapIntensity:.4}));
 glove.name='strike-kit-fitted-work-glove';cloth.name='strike-kit-tailored-sleeve';
 for(const m of[glove,cloth]){m.userData.sharedWeapon=true;m.userData.authoredFinish='original-procedural-pbr-v1';}
 // White materials use their atlas colors. They intentionally ignore the old
 // vertex-color bands, which would double-tint the fabric and hide its detail.
 return {glove,cloth};
}
