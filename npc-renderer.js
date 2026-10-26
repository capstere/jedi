/* Seven-joint skinning for the four CC0 Kenney models. No external runtime. */
'use strict';
function createNpcRenderer({gl,assets=NpcAssets}){
 const models=new Map(assets.variants.map(v=>[v.id,v])),gpu=new Map(),poses=new Map();
 let totalFrames=0,lastStats={drawn:0,culled:0,lod:0,triangles:0},disposed=false;
 const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 function multiply(a,b,out=new Float32Array(16)){for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];out[c*4+r]=v;}return out;}
 function compose(t,q,s,out=new Float32Array(16)){
  const [x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  out.set([(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,t[0],t[1],t[2],1]);return out;
 }
 function qmul(a,b){return[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
 const rotation=(axis,angle)=>[axis[0]*Math.sin(angle/2),axis[1]*Math.sin(angle/2),axis[2]*Math.sin(angle/2),Math.cos(angle/2)];
 function sampleChannel(ch,time){
  const count=ch.path==='rotation'?4:3,times=ch.times,vals=ch.values;
  let i=0;while(i<times.length-2&&time>times[i+1])i++;
  const j=Math.min(i+1,times.length-1),f=Math.max(0,Math.min(1,(time-times[i])/(times[j]-times[i]||1))),a=vals.slice(i*count,(i+1)*count),b=vals.slice(j*count,(j+1)*count);
  if(count!==4)return a.map((v,k)=>v+(b[k]-v)*f);
  let dot=a.reduce((v,x,k)=>v+x*b[k],0);if(dot<0){dot=-dot;for(let k=0;k<4;k++)b[k]=-b[k];}
  if(dot>.9995){const q=a.map((v,k)=>v+(b[k]-v)*f),n=Math.hypot(...q)||1;return q.map(v=>v/n);}
  const angle=Math.acos(Math.max(-1,Math.min(1,dot))),s=Math.sin(angle),u=Math.sin((1-f)*angle)/s,v=Math.sin(f*angle)/s;return a.map((x,k)=>x*u+b[k]*v);
 }
 function samplePose(model,state,time,carry=false){
  const nodes=model.nodes.map(n=>({t:[...n.t],q:[...n.q],s:[...n.s]}));
  const clipName={walk:'walk',turn:'idle',look:'emote-no',gesture:'emote-yes',phone:'holding-both',dance:'emote-yes',deliver:'pick-up',interact:'interact-right'}[state]||'idle';
  function applyClip(name,filter){const clip=model.clips[name];if(!clip)return;const phase=((time%clip.duration)+clip.duration)%clip.duration;for(const ch of clip.channels){if(filter&&!filter(ch))continue;nodes[ch.node][{rotation:'q',translation:'t',scale:'s'}[ch.path]]=sampleChannel(ch,phase);}}
  applyClip(clipName);
  if(carry)applyClip('holding-both',ch=>ch.node===4||ch.node===5);
  // Turning is supplied by navigation yaw. Phone and dance are explicitly
  // documented procedural accents, layered on licensed source clips.
  if(state==='phone')nodes[6].q=qmul(nodes[6].q,rotation([1,0,0],.28));
  if(state==='dance'){
   nodes[0].t[1]+=.025*Math.max(0,Math.sin(time*7));
   nodes[3].q=qmul(nodes[3].q,rotation([0,0,1],Math.sin(time*3.5)*.18));
   nodes[4].q=qmul(nodes[4].q,rotation([0,0,1],.4+Math.sin(time*7)*.3));
   nodes[5].q=qmul(nodes[5].q,rotation([0,0,1],-.4+Math.sin(time*7+1.2)*.3));
  }
  const world=[],result=new Float32Array(nodes.length*16);
  for(let i=0;i<nodes.length;i++){const n=nodes[i],local=compose(n.t,n.q,n.s);world[i]=model.nodes[i].parent<0?local:multiply(world[model.nodes[i].parent],local);multiply(world[i],model.inverseBind.slice(i*16,i*16+16),result.subarray(i*16,i*16+16));}
  return result;
 }
 function typed(text,Type){const raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Type(bytes.buffer);}
 function decode(model,lod){const m=model.lods[lod];if(!m.decoded)m.decoded={positions:typed(m.positions,Float32Array),normals:typed(m.normals,Int8Array),colors:typed(m.colors,Uint8Array),joints:typed(m.joints,Uint8Array),indices:typed(m.indices,Uint16Array)};return m.decoded;}
 const VS=`#version 300 es
 precision highp float;
 layout(location=0)in vec3 a_position;
 layout(location=1)in vec3 a_normal;
 layout(location=2)in vec3 a_color;
 layout(location=3)in float a_joint;
 uniform mat4 u_vp,u_model,u_bones[7];uniform bool u_shadow;
 out vec3 v_color,v_normal,v_world;out vec2 v_shadow;
 void main(){mat4 bone=u_shadow?mat4(1.):u_bones[int(a_joint)];vec4 local=bone*vec4(a_position,1.);vec4 world=u_model*local;
 v_normal=transpose(inverse(mat3(u_model)))*mat3(bone)*a_normal;v_color=a_color;v_world=world.xyz;v_shadow=a_position.xz;gl_Position=u_vp*world;}`;
 const FS=`#version 300 es
 precision highp float;
 in vec3 v_color,v_normal,v_world;in vec2 v_shadow;out vec4 frag;
 uniform vec3 u_eye;uniform bool u_shadow;uniform bool u_selected;
 void main(){if(u_shadow){float r=length(v_shadow);frag=vec4(.08,.13,.14,.20*(1.-smoothstep(.15,1.,r)));return;}
 vec3 n=normalize(v_normal);if(!gl_FrontFacing)n=-n;
 vec3 l=normalize(vec3(-1.5,4.,1.5)-v_world),l2=normalize(vec3(2.3,3.,-2.)-v_world);
 float light=.76+.12*n.y+.23*max(dot(n,l),0.)+.10*max(dot(n,l2),0.);
 float rim=pow(1.-max(dot(n,normalize(u_eye-v_world)),0.),3.)*.05;
 vec3 color=pow(pow(v_color,vec3(2.2))*light,vec3(1./2.2))+rim;
 if(u_selected)color=mix(color,vec3(.31,.82,.76),.06);
 frag=vec4(clamp(color,0.,1.),1.);}`;
 function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('NPC shader: '+gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,VS),fs=shader(gl.FRAGMENT_SHADER,FS);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('NPC program: '+gl.getProgramInfoLog(program));
 const U={};for(const n of ['vp','model','bones','shadow','eye','selected'])U[n]=gl.getUniformLocation(program,'u_'+n);
 function resource(model,lod){
  const key=model.id+':'+lod;if(gpu.has(key))return gpu.get(key);
  const data=decode(model,lod),vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);
  for(const [loc,key,size,type,norm]of[[0,'positions',3,gl.FLOAT,false],[1,'normals',3,gl.BYTE,true],[2,'colors',3,gl.UNSIGNED_BYTE,true],[3,'joints',1,gl.UNSIGNED_BYTE,false]]){
   const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data[key],gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,norm,0,0);
  }
  const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);
  const r={vao,buffers,count:data.indices.length};gpu.set(key,r);return r;
 }
 const shadowVao=gl.createVertexArray(),shadowBuffer=gl.createBuffer(),shadowPositions=[];
 for(let i=0;i<20;i++){const a=i*Math.PI/10,b=(i+1)*Math.PI/10;shadowPositions.push(0,0,0,Math.cos(a),0,Math.sin(a),Math.cos(b),0,Math.sin(b));}
 gl.bindVertexArray(shadowVao);gl.bindBuffer(gl.ARRAY_BUFFER,shadowBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(shadowPositions),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
 function modelFor(id){return models.get(id)||assets.variants[0];}
 function objectMatrix(p,model,shadow=false){
  const height=Math.max(.8,Math.min(2.2,Number(p.height)||model.height)),scale=height/(model.bounds[1][1]-model.bounds[1][0]),yaw=Number(p.yaw)||0;
  return compose([Number(p.x)||0,shadow?.029:(Number(p.y)||.03)-model.bounds[1][0]*scale,Number(p.z)||0],[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],shadow?[.29,1,.24]:[scale*.62,scale,scale*.62]);
 }
 function inFrustum(p,vp,height){const x=p.x,y=(p.y||.03)+height*.5,z=p.z,w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(w<-.2)return false;const a=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],b=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],r=height*Math.max(Math.hypot(vp[0],vp[4],vp[8]),Math.hypot(vp[1],vp[5],vp[9]));return Math.abs(a)<w+r&&Math.abs(b)<w+r;}
 function draw(people,{vp,eye,quality='auto',time=0,selectedId=null}={}){
  if(disposed||!vp||!people.length){lastStats={drawn:0,culled:0,lod:0,triangles:0};return;}
  gl.useProgram(program);gl.uniformMatrix4fv(U.vp,false,vp);gl.uniform3fv(U.eye,eye);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  const visible=[];lastStats={drawn:0,culled:0,lod:0,triangles:0};
  for(const p of people){const model=modelFor(p.appearance),height=p.height||model.height;if(!inFrustum(p,vp,height)){lastStats.culled++;continue;}visible.push({p,model,distance:Math.hypot(p.x-eye[0],height*.5-eye[1],p.z-eye[2])});}
  // Contact shadows use one shared disk and never modify the room mesh.
  gl.uniform1i(U.shadow,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(shadowVao);
  for(const {p,model}of visible){gl.uniformMatrix4fv(U.model,false,objectMatrix(p,model,true));gl.drawArrays(gl.TRIANGLES,0,60);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1i(U.shadow,0);
  const present=new Set(people.map((p,i)=>p.id||i));
  for(const [key]of poses)if(!present.has(key))poses.delete(key);
  for(const {p,model,distance}of visible){
   const lod=quality==='low'||(quality!=='high'&&distance>7.5)?1:0,resourceData=resource(model,lod),state=p.animation||p.state||'idle',rawTime=p.animationTime??p.phase??time;
   const speed=state==='walk'?Math.max(.4,Math.min(2,(p.walkSpeed||.85)/.85)):1,fps=lod?12:quality==='high'?45:30,t=Math.floor(rawTime*speed*fps)/fps,key=p.id||people.indexOf(p),signature=model.id+':'+state+':'+t+':'+!!p.carryBag;
   let pose=poses.get(key);if(!pose||pose.signature!==signature){pose={signature,matrices:samplePose(model,state,t,!!p.carryBag)};poses.set(key,pose);}
   gl.uniform1i(U.selected,p.id===selectedId?1:0);gl.uniformMatrix4fv(U.model,false,objectMatrix(p,model));gl.uniformMatrix4fv(U.bones,false,pose.matrices);gl.bindVertexArray(resourceData.vao);gl.drawElements(gl.TRIANGLES,resourceData.count,gl.UNSIGNED_SHORT,0);
   lastStats.drawn++;lastStats.lod+=lod;lastStats.triangles+=resourceData.count/3;
  }
  gl.bindVertexArray(null);gl.enable(gl.CULL_FACE);totalFrames++;
 }
 function transform(p,m){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
 function thumbnail(canvas,variant){
  const model=modelFor(variant),data=decode(model,0),bones=samplePose(model,'idle',.2),ctx=canvas.getContext('2d'),faces=[],points=[];
  canvas.width=240;canvas.height=210;
  const width=240,height=210,project=p=>[(p[0]*.92+p[2]*.38)*.72,-p[1]+p[2]*.14-p[0]*.06];
  for(let i=0;i<data.positions.length/3;i++){const p=transform(Array.from(data.positions.subarray(i*3,i*3+3)),bones.subarray(data.joints[i]*16,data.joints[i]*16+16));points.push({p,q:project(p)});}
  const xs=points.map(v=>v.q[0]),ys=points.map(v=>v.q[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min((width-46)/(maxX-minX),(height-22)/(maxY-minY));
  for(let i=0;i<data.indices.length;i+=3){
   const ids=Array.from(data.indices.subarray(i,i+3)),v=ids.map(k=>points[k]),a=v[0].p,b=v[1].p,c=v[2].p,u=b.map((x,j)=>x-a[j]),w=c.map((x,j)=>x-a[j]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1,shade=.82+.15*n[1]/len+.16*n[2]/len;
   const color=ids.reduce((sum,id)=>sum.map((s,j)=>s+data.colors[id*3+j]/3),[0,0,0]).map(v=>Math.max(0,Math.min(255,Math.round(v*shade))));
   faces.push({v,depth:v.reduce((s,p)=>s+p.p[2]-.35*p.p[0],0),color});
  }
  ctx.clearRect(0,0,width,height);ctx.fillStyle='rgba(26,61,63,.10)';ctx.beginPath();ctx.ellipse(width/2,height-15,44,7,0,0,Math.PI*2);ctx.fill();
  for(const face of faces.sort((a,b)=>a.depth-b.depth)){ctx.beginPath();face.v.forEach((v,i)=>{const q=[width/2+(v.q[0]-(minX+maxX)/2)*scale,12+(v.q[1]-minY)*scale];i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.fillStyle='rgb('+face.color.join(',')+')';ctx.fill();}
 }
 function diagnostics(){return{...lastStats,frames:totalFrames,meshResources:gpu.size,buffers:[...gpu.values()].reduce((n,v)=>n+v.buffers.length,1),poseCaches:poses.size,source:'Kenney Mini Characters 1.0 / CC0',skinJoints:7};}
 function dispose(){if(disposed)return;for(const r of gpu.values()){gl.deleteVertexArray(r.vao);r.buffers.forEach(b=>gl.deleteBuffer(b));}gpu.clear();poses.clear();gl.deleteVertexArray(shadowVao);gl.deleteBuffer(shadowBuffer);gl.deleteProgram(program);disposed=true;}
 return{draw,thumbnail,diagnostics,dispose,variants:assets.variants.map(({id,label,height})=>({id,label,height})),samplePose:(variant,state,time)=>samplePose(modelFor(variant),state,time),getBounds:variant=>modelFor(variant).bounds};
}
if(typeof module==='object')module.exports={createNpcRenderer};
