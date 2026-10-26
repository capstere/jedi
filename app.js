/* HISSRUM 12 — Life Simulation V5. Native WebGL2, local-only, no runtime dependencies. */
'use strict';
(async function(){
 const $=id=>document.getElementById(id),canvas=$('scene'),hud=$('hud'),host=$('viewport'),ctx=hud.getContext('2d');
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),vec=(x=0,y=0,z=0)=>[x,y,z],add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
 const bounds=MODEL_INFO.bounds,obs=MODEL_INFO.fixedObstructions;
 const state={mode:'orbit',roof:'open',cut:true,labels:true,clay:false,grid:false,tool:'view',eye:[8.8,7.4,9.7],target:[0,.8,0],yaw:0,pitch:0,fov:48,span:9.5,draft:null,hover:null,measures:[],zones:[],keys:new Set(),transition:null};
 let planner=null,elevator=null,simulation=null,simUI=null,npcRenderer=null;
 let gl,meshes=[],textures=[],vp,viewBasis,ready=false,needsRender=true,lastTime=performance.now(),width=0,height=0,lastPointer=null,touchStart=null,moveDist=0,pointerState=new Map(),selectedPreset='overview';
 const door=createLiftDoor({invalidate:()=>{needsRender=true;}});
 const identityModel=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),identityNormal=new Float32Array([1,0,0,0,1,0,0,0,1]);
 const maxDpr=Math.min(devicePixelRatio||1,2);
 const fmt=(v,n=2)=>v.toLocaleString('sv-SE',{minimumFractionDigits:n,maximumFractionDigits:n});
 function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
 function errorView(message){$('loading').innerHTML='<div class="load-mark">12</div><h2>3D kunde inte startas</h2><p></p>'; $('loading').querySelector('p').textContent=message; $('loading').classList.remove('hidden');}
 try{gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw Error('Öppna filen i en webbläsare med WebGL2, exempelvis Edge eller Chrome på dator. Kontrollera att hårdvaruacceleration är tillåten.');}catch(e){errorView(e.message);return;}
 function perspective(fov,aspect,near=.04,far=120){let f=1/Math.tan(fov*Math.PI/360);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]}
 function ortho(w,h){return[2/w,0,0,0,0,2/h,0,0,0,0,-2/120,0,0,0,-1,1]}
 function lookAt(eye,target,up){let z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);viewBasis={r:x,u:y,f:mul(z,-1)};return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]}
 function mm(a,b){let r=new Float32Array(16);for(let c=0;c<4;c++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[c*4+j]+=a[k*4+j]*b[c*4+k];return r}
 function project(p){let w=vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];if(w<=0)return null;return [((vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12])/w*.5+.5)*width,(.5-(vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13])/w*.5)*height]}
 function viewFov(){const outside=state.mode==='orbit'&&(state.eye[1]>3.23||Math.abs(state.eye[0])>3.8||state.eye[2]<-3.8||state.eye[2]>3.64);const factor=outside?Math.max(1,1.08/(width/height)):1;return 2*Math.atan(Math.tan(state.fov*Math.PI/360)*factor)*180/Math.PI;}
 function rayAt(x,y){let nx=x/width*2-1,ny=1-y/height*2,eye=[...state.eye],dir;
  if(state.mode==='plan'){let sy=state.span,sx=sy*width/height;eye=add(eye,add(mul(viewBasis.r,nx*sx/2),mul(viewBasis.u,ny*sy/2)));dir=viewBasis.f;}
  else{let t=Math.tan(viewFov()*Math.PI/360);dir=norm(add(viewBasis.f,add(mul(viewBasis.r,nx*t*width/height),mul(viewBasis.u,ny*t))));}
  return {origin:eye,dir};
 }
 function floorPoint(x,y){let {origin:eye,dir}=rayAt(x,y);if(Math.abs(dir[1])<1e-5)return null;let t=-eye[1]/dir[1];if(t<=0)return null;let p=add(eye,mul(dir,t));if(p[0]<bounds.west||p[0]>bounds.east||p[2]<bounds.north||p[2]>bounds.south)return null;return[p[0],.028,p[2]];}
 const VS=`#version 300 es
 precision highp float;
 layout(location=0)in vec3 a_pos;layout(location=1)in vec3 a_normal;layout(location=2)in vec2 a_uv;
 layout(location=3)in mat4 a_instanceModel;layout(location=7)in mat3 a_instanceNormal;uniform bool u_instanced;
 uniform mat4 u_vp;uniform mat4 u_model;uniform mat3 u_normal;out vec3 v_p;out vec3 v_n;out vec2 v_uv;
 void main(){mat4 model=u_instanced?a_instanceModel:u_model;mat3 normal=u_instanced?a_instanceNormal:u_normal;vec4 world=model*vec4(a_pos,1.);v_p=world.xyz;v_n=normal*a_normal;v_uv=a_uv;gl_Position=u_vp*world;}`;
 const FS=`#version 300 es
 precision highp float;in vec3 v_p;in vec3 v_n;in vec2 v_uv;out vec4 outColor;
 uniform sampler2D u_tex;uniform vec4 u_color;uniform vec3 u_eye;uniform float u_rough;uniform float u_metal;uniform int u_type;uniform int u_clay;uniform int u_grid;uniform float u_clip;uniform int u_shadowCount;uniform vec4 u_shadows[48];uniform vec2 u_shadowRot[48];
 float rectDist(vec2 p,vec2 mn,vec2 mx){vec2 d=max(max(mn-p,p-mx),vec2(0.));return length(d);}
 void main(){if(v_p.y>u_clip)discard;vec3 n=normalize(v_n);if(!gl_FrontFacing)n=-n;vec3 color=texture(u_tex,v_uv).rgb*u_color.rgb;
 if(u_clay==1 && u_type!=3 && u_type!=2)color=vec3(.80,.82,.79);
 if(u_type==3){vec2 p=v_p.xz;float d=rectDist(p,vec2(-3.90,-3.95),vec2(3.95,3.79));float sh=exp(-d*3.3)*.19;vec3 bg=vec3(.884,.902,.898)-sh;
 if(u_grid==1){vec2 g=abs(fract(p+.5)-.5);float line=1.-smoothstep(.005,.012,min(g.x,g.y));bg-=line*.030;}outColor=vec4(bg,1.);return;}
 if(u_type==2){outColor=vec4(mix(color,vec3(1.,.982,.910),.50),1.);return;}
 vec3 base=pow(max(color,vec3(.001)),vec3(2.2));vec3 view=normalize(u_eye-v_p);
 float hemi=.78+.12*n.y;
 vec3 l1=normalize(vec3(-1.5,3.18,-2.2)-v_p),l2=normalize(vec3(2.3,2.48,1.6)-v_p);
 float dl1=max(dot(n,l1),0.),dl2=max(dot(n,l2),0.);
 float light=hemi+.25*dl1+.20*dl2;
 float ao=1.;
 if(v_p.y<.20){float edge=min(min(v_p.x+3.75,3.8-v_p.x),min(v_p.z+3.8,3.64-v_p.z));float cabinet=rectDist(v_p.xz,vec2(-2.72,3.08),vec2(1.,3.64));float west=rectDist(v_p.xz,vec2(-3.75,.11),vec2(-3.02,.89));float east=rectDist(v_p.xz,vec2(3.42,.12),vec2(3.8,.88));float d=min(edge,min(cabinet,min(west,east)));ao=.67+.33*(1.-exp(-max(d,0.)*7.));}
 else if(abs(n.y)<.4){ao*=.84+.16*(1.-exp(-v_p.y*7.));float corner=min(min(abs(v_p.x+3.75),abs(3.80-v_p.x)),min(abs(v_p.z+3.8),abs(3.64-v_p.z)));ao*=.96;}
 if(v_p.y<.025 && u_type==0){float shadow=0.;for(int i=0;i<48;i++){if(i>=u_shadowCount)break;vec4 ob=u_shadows[i];vec2 rt=u_shadowRot[i],d=v_p.xz-ob.xy;vec2 q=vec2(rt.x*d.x+rt.y*d.y,-rt.y*d.x+rt.x*d.y);vec2 outside=max(abs(q)-ob.zw,vec2(0.));float dist=length(outside);shadow=max(shadow,.26*exp(-dist*20.));}ao*=1.-shadow;}
 float expn=mix(15.,160.,1.-u_rough);float spec=pow(max(dot(n,normalize(l1+view)),0.),expn)*.15+pow(max(dot(n,normalize(l2+view)),0.),expn)*.12;
 vec3 specColor=mix(vec3(.09),base,.7*u_metal);
 vec3 linear=base*light*ao+specColor*spec*(1.+u_metal*3.);
 if(u_type==1)linear=base*(.90+.06*dl1);
 linear*=1.02;vec3 result=pow(max(linear,0.),vec3(1./2.2));
 // Soft directional sheen, not mirror reflections, on the worn floor.
 if(v_p.y<.025 && u_clay==0){float stripe=exp(-pow((v_p.x-.6)*.65,2.))*exp(-pow((v_p.z+1.1)*.50,2.));result+=vec3(.013,.014,.013)*stripe;}
 outColor=vec4(clamp(result,0.,1.),u_color.a);}`;
 function compile(type,source){let sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh}
 let prog;
 try{prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));}catch(e){errorView(e.message);return;}
 const U={};for(let n of ['instanced','vp','model','normal','tex','color','eye','rough','metal','type','clay','grid','clip','shadowCount','shadows','shadowRot'])U[n]=gl.getUniformLocation(prog,'u_'+n);
 function bufferAttrib(vao,location,arr,n){gl.bindVertexArray(vao);let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,n,gl.FLOAT,false,0,0);return b}
 function base64Bytes(text){const raw=atob(text),b=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)b[i]=raw.charCodeAt(i);return b}
 let binary;
 try{
 binary=base64Bytes(MODEL_GLB).buffer;let dv=new DataView(binary);if(dv.getUint32(0,true)!==0x46546c67)throw Error('Ogiltig modellfil.');let jsonSize=dv.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(binary,20,jsonSize))),bo=20+jsonSize+8;
 const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 for(let im of j.images||[]){let bv=j.bufferViews[im.bufferView],blob=new Blob([new Uint8Array(binary,bo+(bv.byteOffset||0),bv.byteLength)],{type:im.mimeType});let image;
  if(typeof createImageBitmap==='function')image=await createImageBitmap(blob);
  else image=await new Promise((resolve,reject)=>{let i=new Image();let u=URL.createObjectURL(blob);i.onload=()=>{URL.revokeObjectURL(u);resolve(i)};i.onerror=reject;i.src=u});
  let texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));textures.push(texture);if(image.close)image.close();
 }
 function accessor(index){let a=j.accessors[index],bv=j.bufferViews[a.bufferView],offset=bo+(bv.byteOffset||0)+(a.byteOffset||0),components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},T=types[a.componentType];return {data:new T(binary,offset,a.count*components),type:a.componentType,count:a.count};}
 for(let mesh of j.meshes){for(let p of mesh.primitives){let vao=gl.createVertexArray();let pos=accessor(p.attributes.POSITION);bufferAttrib(vao,0,pos.data,3);bufferAttrib(vao,1,accessor(p.attributes.NORMAL).data,3);bufferAttrib(vao,2,accessor(p.attributes.TEXCOORD_0).data,2);let ind=accessor(p.indices),split=door.splitPrimitive(mesh.name,pos.data,ind.data);let mat=j.materials[p.material]||{},pbr=mat.pbrMetallicRoughness||{},tex=pbr.baseColorTexture?textures[j.textures[pbr.baseColorTexture.index].source]:white;
  for(const [moving,indices] of [[false,split.fixed],[true,split.moving]]){if(!indices.length)continue;gl.bindVertexArray(vao);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);meshes.push({name:mesh.name+(moving?'__moving_right_leaf':''),layer:mesh.name.split('__')[0],vao,indexBuffer:ib,movingDoor:moving,count:indices.length,indexType:ind.type,texture:tex,color:pbr.baseColorFactor||[1,1,1,1],rough:pbr.roughnessFactor??.7,metal:pbr.metallicFactor??0,type:mat.name==='lamp'?2:mat.name?.startsWith('sign_')?1:0});}
 }}
 // Unexported presentation stage under the architectural model.
 let vao=gl.createVertexArray();bufferAttrib(vao,0,new Float32Array([-30,-.206,-30,30,-.206,-30,30,-.206,30,-30,-.206,30]),3);bufferAttrib(vao,1,new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),3);bufferAttrib(vao,2,new Float32Array([0,0,1,0,1,1,0,1]),2);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,2,1,0,3,2]),gl.STATIC_DRAW);
 meshes.unshift({name:'stage',layer:'stage',vao,count:6,indexType:5123,texture:white,color:[1,1,1,1],rough:1,metal:0,type:3});

 const capNames=['fixed_south','pier_west','pier_east'];
 obs.forEach((o,i)=>{let vao=gl.createVertexArray();bufferAttrib(vao,0,new Float32Array([o.x1,.218,o.z1,o.x2,.218,o.z1,o.x2,.218,o.z2,o.x1,.218,o.z2]),3);bufferAttrib(vao,1,new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),3);bufferAttrib(vao,2,new Float32Array([0,0,1,0,1,1,0,1]),2);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,2,1,0,3,2]),gl.STATIC_DRAW);meshes.push({name:'cap_'+capNames[i],layer:'cap_'+capNames[i],vao,count:6,indexType:5123,texture:white,color:[.70,.76,.71,1],rough:1,metal:0,type:0});});
 }catch(e){console.error(e);errorView('Modellen kunde inte läsas: '+e.message);return;}
 const presets={
  overview:{eye:[8.8,7.4,9.7],target:[0,.7,0],fov:48},
  entrance:{eye:[2.76,1.65,2.66],target:[.60,1.43,-3.79],fov:80},
  lift:{eye:[.6,1.65,-3.10],target:[2.22,1.4,2.70],fov:86},
  diagonal:{eye:[-3.04,1.65,2.98],target:[1.4,1.5,-2.6],fov:85},
  plan:{eye:[.025,15,-1.5],target:[.025,0,-1.5],fov:48}
 };
 function setPreset(id,animate=true){if(!presets[id])return;state.tool='view';state.draft=null;state.mode=id==='plan'?'plan':'orbit';selectedPreset=id;state.keys.clear();if(id!=='plan')state.roof=id==='overview'?'open':'full';const p=presets[id];if(id==='plan'){state.eye=[...p.eye];state.target=[...p.target];state.fov=p.fov;state.transition=null;state.span=Math.max(12.6,8.9*height/width);}else if(animate){state.transition={fromE:[...state.eye],fromT:[...state.target],toE:[...p.eye],toT:[...p.target],fromF:state.fov,toF:p.fov,start:performance.now(),duration:650};}else{state.eye=[...p.eye];state.target=[...p.target];state.fov=p.fov;state.transition=null;}syncUI();needsRender=true;}
 function enterWalk(){state.transition=null;state.mode='walk';state.roof='full';state.tool='view';state.draft=null;selectedPreset='walk';if(state.eye[1]>2.5||Math.abs(state.eye[0])>3.7||Math.abs(state.eye[2])>3.7){state.eye=[...presets.entrance.eye];state.target=[...presets.entrance.target];}let d=norm(sub(state.target,state.eye));state.yaw=Math.atan2(d[0],-d[2]);state.pitch=Math.asin(d[1]);if(blocked(state.eye[0],state.eye[2])){let options=[];for(let x=bounds.west+.3;x<bounds.east-.3;x+=.3)for(let z=bounds.north+.3;z<bounds.south-.3;z+=.3)if(!blocked(x,z))options.push([x,z]);options.sort((a,b)=>Math.hypot(a[0]-state.eye[0],a[1]-state.eye[2])-Math.hypot(b[0]-state.eye[0],b[1]-state.eye[2]));if(options.length){state.eye[0]=options[0][0];state.eye[2]=options[0][1];}}
 state.eye[1]=1.65;state.fov=76;syncUI();toast('WASD eller piltangenter går. Dra i bilden för att se dig om. Esc lämnar rundvandringen.');needsRender=true;}
 function loweredSection(layer){if(state.mode!=='orbit'||!state.cut)return false;const e=state.eye;if(e[0]>-3.75&&e[0]<3.80&&e[2]>-3.80&&e[2]<3.64&&e[1]<3.23)return false;return(layer==='fixed_south'&&e[2]>3.64)||(layer==='pier_west'&&e[0]<-3.75)||(layer==='pier_east'&&e[0]>3.80);}
 function visible(layer){if(layer.startsWith('cap_'))return loweredSection(layer.slice(4));if(layer==='stage')return state.mode!=='walk';let inside=Math.abs(state.eye[0])<3.8&&state.eye[2]>-3.8&&state.eye[2]<3.65&&state.eye[1]<3.0,roof=state.mode==='walk'?'full':state.roof;if(state.mode==='plan')roof='open';if(layer.startsWith('ceiling_'))return roof==='full';if(layer==='services'||layer==='beam')return roof!=='open';
  if(state.mode==='walk'||!state.cut||inside)return true;
  if(layer==='north'&&state.eye[2]<-3.6)return false;if(layer==='south'&&state.eye[2]>3.1)return false;if(layer==='east'&&state.eye[0]>3.6)return false;if(layer==='west'&&state.eye[0]<-3.5)return false;return true;
 }
 function resize(){let r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);let w=Math.round(width*maxDpr),h=Math.round(height*maxDpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;hud.width=w;hud.height=h;needsRender=true;}}
 function draw(){resize();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.884,.902,.898,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.useProgram(prog);
  let up=state.mode==='plan'?[0,0,-1]:[0,1,0];let view=lookAt(state.eye,state.target,up);let projection=state.mode==='plan'?ortho(state.span*width/height,state.span):perspective(viewFov(),width/height);vp=mm(projection,view);
  gl.uniform1i(U.instanced,0);gl.uniformMatrix4fv(U.vp,false,vp);gl.uniform3fv(U.eye,state.eye);gl.uniform1i(U.clay,state.clay?1:0);gl.uniform1i(U.grid,state.grid?1:0);gl.uniform1f(U.clip,state.mode==='plan'?1.15:100);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(U.tex,0);gl.uniformMatrix4fv(U.model,false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));gl.uniformMatrix3fv(U.normal,false,new Float32Array([1,0,0,0,1,0,0,0,1]));planner?.prepareRender();
  const doorPose=door.matrix;for(let m of meshes){if(!visible(m.layer))continue;gl.uniformMatrix4fv(U.model,false,m.movingDoor?doorPose.model:identityModel);gl.uniformMatrix3fv(U.normal,false,m.movingDoor?doorPose.normal:identityNormal);gl.uniform1f(U.clip,state.mode==='plan'?1.15:loweredSection(m.layer)?.22:100);gl.bindVertexArray(m.vao);if(m.indexBuffer)gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer);gl.bindTexture(gl.TEXTURE_2D,m.texture);gl.uniform4fv(U.color,m.color);gl.uniform1f(U.rough,m.rough);gl.uniform1f(U.metal,m.metal);gl.uniform1i(U.type,m.type);gl.drawElements(gl.TRIANGLES,m.count,m.indexType,0);}
  elevator?.draw3D({mode:state.mode,roof:state.roof,eye:state.eye});planner?.draw3D();simUI?.drawProps();simUI?.drawPeople(vp);drawHUD();$('headingMode').textContent=state.mode==='walk'?'Rundvandring':state.mode==='plan'?'Planvy':'3D-modell';$('hintText').textContent=state.tool==='measure'?'Klicka två punkter på golvet för att mäta.':state.tool==='zone'?'Klicka två motsatta hörn på golvet.':state.mode==='walk'?'Dra: se dig om  ·  WASD / piltangenter: gå  ·  Esc: översikt':state.mode==='plan'?'Dra: panorera  ·  Scrolla / nyp: zooma':'Dra: rotera  ·  Högerdra: panorera  ·  Scrolla / nyp: zooma';
  if(elevator)$('elevatorStatus').textContent=elevator.status;
  $('northNeedle').style.transform='rotate('+(-Math.atan2(state.eye[0]-state.target[0],state.eye[2]-state.target[2])*180/Math.PI)+'deg)';
 }
 function pill(x,y,text,color='#243e4d',bg='rgba(255,255,251,.94)',size=12){ctx.font=`600 ${size}px system-ui,-apple-system,Segoe UI,sans-serif`;let tw=ctx.measureText(text).width,w=tw+20,h=28;ctx.fillStyle=bg;ctx.strokeStyle='rgba(63,89,90,.15)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,7);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+.3);}
 function worldLine(a,b,color='#da8b48',dash=false){let pa=project(a),pb=project(b);if(!pa||!pb)return;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash?[6,5]:[]);ctx.beginPath();ctx.moveTo(...pa);ctx.lineTo(...pb);ctx.stroke();ctx.setLineDash([]);for(let p of [pa,pb]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}pill((pa[0]+pb[0])/2,(pa[1]+pb[1])/2-17,'ca '+fmt(Math.hypot(b[0]-a[0],b[2]-a[2]))+' m');}
 function zoneHUD(a,b,name,draft=false){let x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),z0=Math.min(a[2],b[2]),z1=Math.max(a[2],b[2]),corners=[[x0,.04,z0],[x1,.04,z0],[x1,.04,z1],[x0,.04,z1]].map(project);if(corners.some(p=>!p))return;ctx.beginPath();ctx.moveTo(...corners[0]);corners.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle='rgba(51,125,105,.11)';ctx.fill();ctx.strokeStyle='#368970';ctx.lineWidth=2;ctx.setLineDash(draft?[5,4]:[]);ctx.stroke();ctx.setLineDash([]);let c=project([(x0+x1)/2,.05,(z0+z1)/2]);pill(c[0],c[1],name+'  ·  '+fmt(x1-x0)+' × '+fmt(z1-z0)+' m','#296a57');}


 function drawPlan(){
  function poly(points,fill,stroke=null,line=1){let ps=points.map(p=>project([p[0],.035,p[1]]));if(ps.some(p=>!p))return;ctx.beginPath();ctx.moveTo(...ps[0]);ps.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function rect(a,b,c,d,fill,stroke=null){poly([[a,b],[c,b],[c,d],[a,d]],fill,stroke);}
  // Floor and wall section are opaque: false shadows from clipped meshes are not shown.
  rect(bounds.west-.15,bounds.north-.15,bounds.east+.15,bounds.south+.15,'#687973');
  rect(bounds.west,bounds.north,bounds.east,bounds.south,'#f2f4ec');
  if(state.grid){for(let x=-3;x<=3;x++){let a=project([x,.04,bounds.north]),b=project([x,.04,bounds.south]);ctx.strokeStyle='#dce3d9';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}for(let z=-3;z<=3;z++){let a=project([bounds.west,.04,z]),b=project([bounds.east,.04,z]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}}
  for(let o of obs)rect(o.x1,o.z1,o.x2,o.z2,'#d1dacf','#889c8d');
  rect(-2.60,bounds.north-.15,-1.08,bounds.north+.045,'#b95150');
  rect(-.46,bounds.north-.15,1.045,bounds.north+.045,'#7393a0');
  const dm=door.matrix.model;poly([[1.046,-3.82],[2.464,-3.82],[2.464,-3.755],[1.046,-3.755]].map(([x,z])=>[dm[0]*x+dm[8]*z+dm[12],dm[2]*x+dm[10]*z+dm[14]]),'#7393a0','#416777',1.5);
  rect(bounds.west-.15,1.05,bounds.west+.045,3.44,'#527f9b');
  rect(bounds.east-.045,1.35,bounds.east+.15,3.4,'#b2c4b1');
  // Indicate the split in each pair of doors without asserting safety clearances.
  let segments=[[[1.04,-3.94],[1.04,-3.67]],[[-2.04,-3.94],[-2.04,-3.67]],[[-3.89,2.245],[-3.66,2.245]],[[3.70,2.375],[3.95,2.375]]];
  ctx.strokeStyle='#f6f9f2';ctx.lineWidth=2;for(let [a,b] of segments){a=project([a[0],.04,a[1]]);b=project([b[0],.04,b[1]]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
 }
 function drawHUD(){ctx.setTransform(maxDpr,0,0,maxDpr,0,0);ctx.clearRect(0,0,width,height);if(state.mode==='plan')drawPlan();elevator?.drawHUD(ctx,project,state.mode);
  if(door.showSweep&&door.target>0){const ps=door.sweepPolygon().map(([x,z])=>project([x,.035,z]));if(ps.every(Boolean)){ctx.beginPath();ctx.moveTo(...ps[0]);ps.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle='rgba(223,156,52,.13)';ctx.fill();ctx.strokeStyle='rgba(184,114,26,.70)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);}}
  if(state.labels){let labels=state.mode==='plan'?[['HISS 12',[1.04,.10,-3.38]],['NÖDUTGÅNG',[-1.84,.10,-3.38]],['ENTRÉ',[3.20,.1,2.38]],['INBYGGDA ELSKÅP',[-.86,.1,3.16]]]:[['Hiss 12',[1.04,3.1,-3.8]],['Nödutgång',[-1.84,2.48,-3.8]],['Entré',[3.55,.14,2.38]]];
   for(let [label,pos] of labels){let p=project(pos);if(p&&p[0]>70&&p[0]<width-60&&p[1]>30&&p[1]<height-80)pill(p[0],p[1],label,'#385055','rgba(255,255,253,.9)',11);}}
  state.measures.forEach(m=>worldLine(m.a,m.b));state.zones.forEach(z=>zoneHUD(z.a,z.b,z.name));
  if(state.draft&&state.hover){if(state.tool==='measure')worldLine(state.draft,state.hover,'#d38745',true);else if(state.tool==='zone')zoneHUD(state.draft,state.hover,'Ny yta',true);}
  if(state.tool!=='view'&&state.hover){let p=project(state.hover);if(p){ctx.strokeStyle='#28735f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...p,7,0,Math.PI*2);ctx.moveTo(p[0]-12,p[1]);ctx.lineTo(p[0]+12,p[1]);ctx.moveTo(p[0],p[1]-12);ctx.lineTo(p[0],p[1]+12);ctx.stroke();}}
  simUI?.drawUnderlay();planner?.drawHUD();simUI?.drawHUD();
  if(state.mode==='plan'){let a=project([-3.75,.1,-4.18]),b=project([3.8,.1,-4.18]);if(a&&b){ctx.strokeStyle='#7a8d8b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();pill((a[0]+b[0])/2,a[1],'ca '+fmt(MODEL_INFO.width)+' m','#526767');}}
 }
 function clearTool(){state.tool='view';state.draft=null;state.hover=null;syncUI();needsRender=true;}
 function toolClick(p){if(!p){toast('Välj en punkt på rummets golv.');return;}if(!state.draft){state.draft=p;state.hover=p;needsRender=true;return;}let a=state.draft,b=p;if(Math.hypot(a[0]-b[0],a[2]-b[2])<.06){state.draft=null;return;}
  if(state.tool==='measure'){if(state.measures.length>=20){toast('Rensa några mått först.');return;}state.measures.push({a,b});toast('Ungefärligt avstånd: '+fmt(Math.hypot(a[0]-b[0],a[2]-b[2]))+' m');}
  else{if(state.zones.length>=12){toast('Max 12 markerade ytor.');return;}if(Math.abs(a[0]-b[0])<.1||Math.abs(a[2]-b[2])<.1){toast('Ytan behöver vara minst 10 cm i båda riktningar.');return;}state.zones.push({a,b,name:'Yta '+(state.zones.length+1)});}
  state.draft=null;refreshAnnotations();needsRender=true;
 }
 function refreshAnnotations(){let list=$('annotations');list.replaceChildren();const all=[...state.measures.map((m,i)=>({text:'Mått '+(i+1)+' · ca '+fmt(Math.hypot(m.a[0]-m.b[0],m.a[2]-m.b[2]))+' m',kind:'measure',i})),...state.zones.map((z,i)=>({text:z.name+' · '+fmt(Math.abs(z.a[0]-z.b[0]))+' × '+fmt(Math.abs(z.a[2]-z.b[2]))+' m',kind:'zone',i}))];
  if(!all.length){let t=document.createElement('p');t.className='empty-notes';t.textContent='Inga mått eller ytor tillagda.';list.append(t);}for(let item of all){let row=document.createElement('div');row.className='annotation';let span=document.createElement('span');span.textContent=item.text;let b=document.createElement('button');b.textContent='×';b.title='Ta bort';b.onclick=()=>{(item.kind==='measure'?state.measures:state.zones).splice(item.i,1);refreshAnnotations();needsRender=true;};row.append(span,b);list.append(row);}planner?.externalChange();}
 function syncUI(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===selectedPreset));document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));document.querySelectorAll('[data-roof]').forEach(b=>b.classList.toggle('active',b.dataset.roof===state.roof));$('walkPad').classList.toggle('show',state.mode==='walk');$('toolCancel').hidden=state.tool==='view';$('viewport').classList.toggle('tool-mode',state.tool!=='view');$('toggleCut').checked=state.cut;$('toggleLabels').checked=state.labels;$('toggleClay').checked=state.clay;$('toggleGrid').checked=state.grid;planner?.update();}
 function orbit(dx,dy){let d=sub(state.eye,state.target),r=Math.hypot(...d),az=Math.atan2(d[0],d[2]),el=Math.acos(clamp(d[1]/r,-1,1));az-=dx*.006;el=clamp(el+dy*.006,.08,1.52);state.eye=add(state.target,[r*Math.sin(el)*Math.sin(az),r*Math.cos(el),r*Math.sin(el)*Math.cos(az)]);}
 function pan(dx,dy){let scale=state.mode==='plan'?state.span/height:Math.hypot(...sub(state.eye,state.target))*.0013;let delta=add(mul(viewBasis.r,-dx*scale),mul(viewBasis.u,dy*scale));if(state.mode==='plan')delta[1]=0;state.eye=add(state.eye,delta);state.target=add(state.target,delta);}
 function zoom(delta){if(state.mode==='plan'){state.span=clamp(state.span*Math.exp(delta*.0011),2.5,22);}else if(state.mode!=='walk'){let d=sub(state.eye,state.target),r=Math.hypot(...d),nr=clamp(r*Math.exp(delta*.001),1.3,32);state.eye=add(state.target,mul(d,nr/r));}needsRender=true;}
 host.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select,textarea')||e.target.closest('.no-camera'))return;if(!ready)return;if(simUI?.handlePointer('down',e))return;if(planner?.handlePointer('down',e))return;host.setPointerCapture(e.pointerId);pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPointer={x:e.clientX,y:e.clientY,button:e.button,id:e.pointerId};moveDist=0;state.transition=null;});
 host.addEventListener('pointermove',e=>{if(simUI?.handlePointer('move',e))return;if(planner?.handlePointer('move',e))return;let r=host.getBoundingClientRect();if(state.tool!=='view'){state.hover=floorPoint(e.clientX-r.left,e.clientY-r.top);needsRender=true;}let prev=pointerState.get(e.pointerId);if(!prev)return;let dx=e.clientX-prev.x,dy=e.clientY-prev.y;moveDist+=Math.abs(dx)+Math.abs(dy);pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointerState.size===2){let a=[...pointerState.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};if(touchStart){zoom((touchStart.dist-dist)*2.3);pan(mid.x-touchStart.x,mid.y-touchStart.y);}touchStart={dist,...mid};needsRender=true;return;}
  if(state.tool!=='view'&&lastPointer?.button!==2)return;
  if(state.mode==='walk'){state.yaw+=dx*.004;state.pitch=clamp(state.pitch-dy*.004,-1.22,1.22);}else if(state.mode==='plan'||lastPointer?.button===2||e.shiftKey)pan(dx,dy);else orbit(dx,dy);needsRender=true;
 });
 function pointerEnd(e){if(simUI?.handlePointer('up',e))return;if(planner?.handlePointer('up',e))return;let r=host.getBoundingClientRect();if(pointerState.has(e.pointerId)&&moveDist<6&&state.tool!=='view'&&lastPointer?.button!==2)toolClick(floorPoint(e.clientX-r.left,e.clientY-r.top));pointerState.delete(e.pointerId);touchStart=null;if(!pointerState.size)lastPointer=null;}
 host.addEventListener('pointerup',pointerEnd);host.addEventListener('pointercancel',e=>{simUI?.handlePointer('cancel',e);planner?.handlePointer('cancel',e);pointerState.clear();lastPointer=null;touchStart=null;});host.addEventListener('contextmenu',e=>e.preventDefault());host.addEventListener('wheel',e=>{e.preventDefault();simUI?.stopFollow();state.transition=null;zoom(e.deltaY);},{passive:false});
 function blocked(x,z){const r=.18;if(elevator?!elevator.canWalk(x,z,r,[state.eye[0],state.eye[2]]):x<bounds.west+r||x>bounds.east-r||z<bounds.north+r||z>bounds.south-r)return true;return obs.some(o=>x>o.x1-r&&x<o.x2+r&&z>o.z1-r&&z<o.z2+r)||!!planner?.walkBlocked(x,z);}
 function walk(dt){let forward=(state.keys.has('w')||state.keys.has('arrowup')?1:0)-(state.keys.has('s')||state.keys.has('arrowdown')?1:0),right=(state.keys.has('d')||state.keys.has('arrowright')?1:0)-(state.keys.has('a')||state.keys.has('arrowleft')?1:0);if(state.keys.has('q'))state.yaw-=dt*1.3;if(state.keys.has('e'))state.yaw+=dt*1.3;let mag=Math.hypot(forward,right)||1;let sp=dt*(state.keys.has('shift')?2.7:1.5)/mag;let dx=(Math.sin(state.yaw)*forward+Math.cos(state.yaw)*right)*sp,dz=(-Math.cos(state.yaw)*forward+Math.sin(state.yaw)*right)*sp;let [x,y,z]=state.eye;if(!blocked(x+dx,z))x+=dx;if(!blocked(x,z+dz))z+=dz;state.eye=[x,1.65,z];let cp=Math.cos(state.pitch);state.target=add(state.eye,[Math.sin(state.yaw)*cp,Math.sin(state.pitch),-Math.cos(state.yaw)*cp]);return forward||right||state.keys.size;}
 window.addEventListener('keydown',e=>{if(simUI?.handleKey(e))return;if(planner?.handleKey(e))return;if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;let key=e.key.toLowerCase();if(key==='escape'){if(state.tool!=='view')clearTool();else setPreset('overview');}if(state.mode==='walk'&&['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();state.keys.add(key);}});window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>state.keys.clear());
 document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);state.keys.add(k)};b.onpointerup=()=>state.keys.delete(k);b.onpointercancel=()=>state.keys.delete(k);});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{simUI?.cancel();simUI?.stopFollow();planner?.cancelPlacement();b.dataset.view==='walk'?enterWalk():setPreset(b.dataset.view);});
 document.querySelectorAll('[data-roof]').forEach(b=>b.onclick=()=>{state.roof=b.dataset.roof;syncUI();needsRender=true;});
 document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{planner?.cancelPlacement();if(state.mode==='walk')setPreset('plan',false);state.tool=state.tool===b.dataset.tool?'view':b.dataset.tool;state.draft=null;syncUI();toast(state.tool==='measure'?'Klicka två punkter på golvet.':state.tool==='zone'?'Klicka två motsatta hörn. Ytan läggs bara som en markering.':'Verktyget avslutat.');});
 for(let [id,key] of [['toggleCut','cut'],['toggleLabels','labels'],['toggleClay','clay'],['toggleGrid','grid']])$(id).onchange=e=>{state[key]=e.target.checked;needsRender=true;};
 $('toolCancel').onclick=clearTool;$('clearAnnotations').onclick=()=>{state.measures=[];state.zones=[];clearTool();refreshAnnotations();toast('Alla mått och ytor är rensade.');};
 function download(data,name,type){const blob=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 $('saveGLB').onclick=()=>download(binary,'Hissrum12_REKONSTRUERAT_V2.glb','model/gltf-binary');
 $('saveImage').onclick=()=>{draw();let out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;let c=out.getContext('2d');c.drawImage(canvas,0,0);c.drawImage(hud,0,0);c.fillStyle='rgba(244,247,243,.93)';c.fillRect(24,out.height-56,630,36);c.fillStyle='#294348';c.font='18px system-ui';c.fillText('HISSRUM 12  ·  V5  ·  Layout & leksimulering / uppskattad modell',38,out.height-32);out.toBlob(b=>{if(b)download(b,'Hissrum12_V5_'+new Date().toISOString().slice(0,10)+'.png');},'image/png');toast('Bilden sparas från den aktuella vyn.');};
 $('saveLayout').onclick=()=>download(JSON.stringify({format:'hissrum12-v2-annotations',version:2,model:'2026-10-20',measures:state.measures,zones:state.zones},null,2),'Hissrum12_V2_matt_och_ytor.json','application/json');
 $('openLayout').onclick=()=>$('layoutFile').click();$('layoutFile').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;if(f.size>200000)throw Error('Filen är för stor.');let j=JSON.parse(await f.text());if(j.format!=='hissrum12-v2-annotations')throw Error('Inte en V2-markeringsfil.');let valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&p[0]>=-3.76&&p[0]<=3.81&&p[2]>=-3.81&&p[2]<=3.65;let items=[...(j.measures||[]),...(j.zones||[])];if(items.length>32||items.some(m=>!valid(m.a)||!valid(m.b)))throw Error('Ogiltiga måttpunkter.');state.measures=(j.measures||[]).slice(0,20);state.zones=(j.zones||[]).slice(0,12).map((z,i)=>({...z,name:String(z.name||'Yta '+(i+1)).slice(0,40)}));refreshAnnotations();setPreset('plan');toast('Mått och ytor inlästa.');}catch(er){toast('Kunde inte läsa filen: '+er.message)}e.target.value='';};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch(e){toast('Helskärm är inte tillgänglig här. Använd webbläsarens helskärmsläge.')}};
 $('menuButton').onclick=()=>document.body.classList.toggle('panel-open');$('closePanel').onclick=()=>document.body.classList.remove('panel-open');
 const ro=new ResizeObserver(()=>{resize();needsRender=true;});ro.observe(host);window.addEventListener('resize',()=>{resize();needsRender=true;});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;errorView('3D-grafiken pausades av webbläsaren. Ladda om filen för att fortsätta.');});
 function frame(time){let dt=Math.min((time-lastTime)/1000,.04);lastTime=time;if(!ready){requestAnimationFrame(frame);return;}if(state.transition){let t=clamp((time-state.transition.start)/state.transition.duration,0,1),s=t*t*(3-2*t),tr=state.transition;state.eye=tr.fromE.map((v,i)=>v+(tr.toE[i]-v)*s);state.target=tr.fromT.map((v,i)=>v+(tr.toT[i]-v)*s);state.fov=tr.fromF+(tr.toF-tr.fromF)*s;if(t===1)state.transition=null;needsRender=true;}if(door.tick(time))needsRender=true;if(elevator?.tick(time))needsRender=true;if(simUI?.tick(dt))needsRender=true;if(state.mode==='walk'){walk(dt);needsRender=true;}if(needsRender){draw();needsRender=false;}requestAnimationFrame(frame);}
 elevator=createFreightElevator({gl,U,whiteTexture:meshes[0].texture,door,state,invalidate:()=>{needsRender=true;},toast});
 $('elevator3').onclick=()=>elevator.setFloor(3);$('elevator5').onclick=()=>elevator.setFloor(5);$('elevatorLights').onchange=e=>elevator.setLights(e.target.checked);$('elevatorSound').onchange=e=>elevator.setSound(e.target.checked);
 planner=createLayoutPlanner({$,gl,U,state,info:MODEL_INFO,ctx,host,project,floorPoint,rayAt,viewport:()=>({width,height,dpr:maxDpr}),invalidate:()=>{needsRender=true;},toast,download,setView:setPreset,clearTool,refreshAnnotations,binary,door,elevator,onLayoutChange:()=>{simulation?.invalidate();simUI?.refresh();},onFurnitureIntent:()=>{simUI?.cancel();simUI?.select(null);},onFurnitureSelect:()=>{simUI?.cancel();simUI?.select(null);},whiteTexture:meshes[0].texture});
 simulation=PeopleSimulation.create({info:MODEL_INFO,getLayout:()=>planner.snapshot(),getDoor:()=>({angle:door.degrees,direction:door.direction}),getElevator:()=>FreightElevatorGeometry,onMessage:toast});
 npcRenderer=createNpcRenderer({gl});
 simUI=createSimulationUI({$,gl,U,state,info:MODEL_INFO,host,ctx,project,rayAt,viewport:()=>({width,height,dpr:maxDpr}),invalidate:()=>{needsRender=true;},toast,download,planner,elevator,door,simulation,renderer:npcRenderer,clearTool,setView:setPreset,whiteTexture:meshes[0].texture});
 setupSimulationModes({$,simulation,simUI,planner,door,setView:setPreset,invalidate:()=>{needsRender=true;},toast});
 refreshAnnotations();syncUI();resize();ready=true;window.APP_READY=true;$('loading').classList.add('hidden');requestAnimationFrame(frame);
 // Local inspection hooks for browser tests. No network or remote API.
 window.HISSRUM={planner,state,door,elevator,simulation,simUI,npcRenderer,blocked,info:MODEL_INFO,setView:(id)=>{setPreset(id,false);draw();},enterWalk,render:draw,visible,gl,meshes,floorPoint,project,refreshAnnotations,renderInfo:()=>({meshes:meshes.filter(m=>m.layer!=='stage'&&!m.layer.startsWith('cap_')).length,triangles:MODEL_INFO.modelTriangles,errors:gl.getError(),mode:state.mode,eye:[...state.eye]})};
})();
