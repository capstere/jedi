/* Hissrum 12 V5 — estimated freight cabin behind the unchanged V2 lift opening.
 * No external assets. Batches use LayoutCore's p/n/uv convention. The V4 leaf
 * remains the only movable door. Floor travel is an explicitly visual illusion.
 */
(function(root){
  'use strict';
  const bounds=Object.freeze({west:-.38,east:2.46,north:-6.65,south:-3.80,height:2.90});
  const roomBounds=Object.freeze({west:-3.75,east:3.80,north:-3.80,south:3.64});
  const portal=Object.freeze({west:1.07,east:2.44,z:-3.80});
  const spawn=Object.freeze({x:1.65,z:-4.45});
  const hinge=[2.44,-3.755],leafWidth=1.394;
  const I4=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),I3=new Float32Array([1,0,0,0,1,0,0,0,1]);
  const colors={steelCabin:[.51,.56,.59,1],steelCabinRail:[.24,.29,.32,1],steelCabinBright:[.73,.78,.80,1],cabinFloor:[.17,.21,.23,1],steelCabinTread:[.24,.29,.31,1],cabinSeam:[.10,.13,.15,1],cabinLamp:[.94,.96,.90,1],cabinScreen:[.035,.075,.08,1],cabinDigit:[.35,.92,.74,1],cabinButton:[.68,.74,.73,1],cabinLabel:[.91,.94,.89,1]};
  if(root.LayoutCore)Object.assign(root.LayoutCore.MATS,colors);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function segmentDistance(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-ax-dx*t,z-az-dz*t);}
  function portalOpen(angle,radius=.22){return Number(angle)>=55&&portal.east-portal.west>2*radius+.06;}
  function doorwayBlocked(x,z,radius=.22,angle=0,direction=1){
    if(![x,z,radius,angle].every(Number.isFinite))return true;
    const a=clamp(angle,0,90)*Math.PI/180,bx=hinge[0]-leafWidth*Math.cos(a),bz=hinge[1]+(direction===-1?-1:1)*leafWidth*Math.sin(a);
    return segmentDistance(x,z,hinge[0],hinge[1],bx,bz)<Math.max(0,radius)+.045;
  }
  function contains(x,z,r=0){return x>=bounds.west+r&&x<=bounds.east-r&&z>=bounds.north+r&&z<=bounds.south-r;}
  function isNavigable(x,z,radius=.22,angle=0,direction=1){
    if(![x,z,radius].every(Number.isFinite)||radius<0||radius>.75)return false;
    const room=x>=roomBounds.west+radius&&x<=roomBounds.east-radius&&z>=roomBounds.north+radius&&z<=roomBounds.south-radius;
    const cabin=contains(x,z,radius);
    const passage=portalOpen(angle,radius)&&x>=portal.west+radius&&x<=portal.east-radius&&z>=portal.z-radius-.02&&z<=portal.z+radius+.02;
    return (room||cabin||passage)&&!doorwayBlocked(x,z,radius,angle,direction);
  }
  function createBuilder(){
    const parts=new Map();
    const batch=(mat,layer='body')=>{const key=layer+':'+mat;if(!parts.has(key))parts.set(key,{mat,layer,p:[],n:[],uv:[]});return parts.get(key);};
    function quad(a,b,c,d,mat,layer){const p=batch(mat,layer),u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;n.forEach((v,i)=>n[i]=v/l);for(const q of[a,b,c,a,c,d])p.p.push(...q),p.n.push(...n);p.uv.push(0,0,1,0,1,1,0,0,1,1,0,1);}
    function box(x,y,z,w,h,d,mat,layer){
      const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
      quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],mat,layer);quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],mat,layer);
      quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],mat,layer);quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],mat,layer);
      quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],mat,layer);quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],mat,layer);
    }
    function tread(x,z,angle){const c=Math.cos(angle),s=Math.sin(angle),p=[[-.043,-.009],[.043,-.009],[.052,0],[.043,.009],[-.043,.009],[-.052,0]].map(([a,b])=>[x+a*c-b*s,.009,z+a*s+b*c]);const part=batch('steelCabinTread','floor');for(let i=1;i<p.length-1;i++){part.p.push(...p[0],...p[i+1],...p[i]);part.n.push(0,1,0,0,1,0,0,1,0);part.uv.push(0,0,1,0,1,1);}}
    function seven(x,y,z,digit,scale=.21,mat='cabinDigit',layer='display'){
      const bars={a:[0,1,.72,.11],b:[.42,.5,.11,.77],c:[.42,-.5,.11,.77],d:[0,-1,.72,.11],e:[-.42,-.5,.11,.77],f:[-.42,.5,.11,.77],g:[0,0,.72,.11]};
      const map={3:'abgcd',5:'afgcd'};for(const id of map[digit]||map[3]){const [dx,dy,w,h]=bars[id];box(x+dx*scale,y+dy*scale,z,w*scale,h*scale,.004,mat,layer);}
    }
    function finish(){return [...parts.values()].map(p=>({...p,p:new Float32Array(p.p),n:new Float32Array(p.n),uv:new Float32Array(p.uv)}));}
    return {box,quad,tread,seven,finish};
  }
  function buildGeometry({floor=3,lights=true}={}){
    const b=createBuilder(),{box}=b,x=(bounds.west+bounds.east)/2,z=(bounds.north+bounds.south)/2,w=bounds.east-bounds.west,d=bounds.south-bounds.north,h=bounds.height;
    box(x,-.055,z,w+.16,.11,d+.10,'cabinFloor','floor');
    // Plate joints and repeated raised chevrons are geometry, visible offline and in GLB.
    for(let xx=bounds.west+.11;xx<bounds.east-.08;xx+=.16)for(let zz=bounds.north+.13;zz<bounds.south-.10;zz+=.16)b.tread(xx,zz,Math.round((xx-bounds.west)/.16)%2?Math.PI/4:-Math.PI/4);
    for(const zz of[-5.70,-4.75])box(x,.004,zz,w,.004,.009,'cabinSeam','floor');
    box(bounds.west-.045,h/2,z,.09,h,d+.10,'steelCabin');box(bounds.east+.045,h/2,z,.09,h,d+.10,'steelCabin');box(x,h/2,bounds.north-.045,w+.18,h,.09,'steelCabin');
    for(const yy of[.13,.77,1.25]){
      box(x,yy,bounds.north+.036,w,.105,.07,'steelCabinRail');
      for(const xx of[bounds.west+.036,bounds.east-.036])box(xx,yy,z,.07,.105,d,'steelCabinRail');
      if(yy>.2){box(x,yy+.038,bounds.north+.077,w,.012,.012,'steelCabinBright');for(const xx of[bounds.west+.077,bounds.east-.077])box(xx,yy+.038,z,.012,.012,d,'steelCabinBright');}
    }
    for(let xx=bounds.west+.48;xx<bounds.east;xx+=.48)box(xx,h/2,bounds.north+.003,.011,h,.007,'cabinSeam');
    for(let zz=bounds.north+.48;zz<bounds.south;zz+=.48)for(const xx of[bounds.west+.003,bounds.east-.003])box(xx,h/2,zz,.007,h,.011,'cabinSeam');
    // Folded corners and sturdy rail fixings make this read as a freight cabin.
    for(const xx of[bounds.west+.033,bounds.east-.033]){box(xx,h/2,bounds.north+.034,.066,h,.068,'steelCabinBright');for(let zz=bounds.north+.24;zz<bounds.south;zz+=.64)for(const yy of[.77,1.25])box(xx+(xx<x?.044:-.044),yy,zz,.008,.021,.021,'steelCabinBright');}
    box(x,h+.035,z,w+.18,.07,d+.12,'steelCabin','ceiling');
    for(const xx of[x-.64,x+.64]){box(xx,h-.025,z,.18,.09,1.82,'steelCabinRail','ceiling');box(xx,h-.075,z,.11,.012,1.69,lights?'cabinLamp':'cabinSeam','lamp');}
    // The real V4 frame and threshold stay intact. This continuation is behind it.
    box(1.755,.010,-3.87,1.37,.020,.14,'steelCabinBright','floor');
    for(const zz of[-3.825,-3.865,-3.905])box(1.755,.022,zz,1.35,.003,.007,'cabinSeam','floor');
    // Rear display is visible through the open leaf. Side panel is at hand height.
    box(1.57,2.20,bounds.north+.05,.62,.53,.08,'steelCabinRail');box(1.57,2.20,bounds.north+.093,.52,.44,.009,'cabinScreen');b.seven(1.57,2.20,bounds.north+.102,floor,.17);
    box(bounds.east-.035,1.35,-4.24,.07,.69,.31,'steelCabinBright');
    for(const [yy,num]of[[1.52,3],[1.25,5]]){
      box(bounds.east-.078,yy,-4.24,.019,.12,.12,num===floor?'cabinDigit':'cabinButton');
      // Small inset is dark; facing side panel has physical button relief.
      box(bounds.east-.091,yy,-4.24,.008,.052,.052,'cabinScreen');
    }
    box(bounds.east-.08,1.04,-4.24,.02,.075,.14,'cabinLabel');
    return b.finish();
  }
  function createFreightElevator({gl,U,whiteTexture,door,state={},invalidate=()=>{},toast=()=>{}}={}){
    let floor=3,lights=true,sound=false,ride=null,lastTarget=door?.target||0,audio=null,resources=[],disposed=false,displaySignature='';
    let batches=buildGeometry({floor,lights});
    function disposeResources(){if(gl)for(const p of resources){gl.deleteVertexArray(p.vao);for(const b of p.buffers)gl.deleteBuffer(b);}resources=[];}
    function upload(){
      if(!gl)return;disposeResources();for(const part of batches){const vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);for(const [i,a,size]of[[0,part.p,3],[1,part.n,3],[2,part.uv,2]]){const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,0,0);}resources.push({...part,vao,buffers,count:part.p.length/3});}displaySignature=floor+':'+lights;
    }
    function rebuildDisplay(){if(displaySignature===floor+':'+lights)return;batches=buildGeometry({floor,lights});upload();invalidate();}
    function chime(kind='door'){
      if(!sound||!audio)return;try{if(audio.state==='suspended')audio.resume();const now=audio.currentTime;for(let i=0;i<(kind==='arrive'?2:1);i++){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=(kind==='arrive'?660:420)*(i?1.25:1);gain.gain.setValueAtTime(0,now+i*.14);gain.gain.linearRampToValueAtTime(.045,now+i*.14+.012);gain.gain.exponentialRampToValueAtTime(.001,now+i*.14+.20);osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.14);osc.stop(now+i*.14+.21);}}catch(_){/* Optional audio never blocks the offline scene. */}
    }
    function setSound(enabled){sound=!!enabled;if(sound&&!audio){const Context=root.AudioContext||root.webkitAudioContext;if(Context)try{audio=new Context();audio.resume();}catch(_){sound=false;}else sound=false;}if(sound)chime();return sound;}
    function setFloor(value){
      const requested=Number(value);if(requested!==3&&requested!==5)return false;
      if(ride||requested===floor)return false;
      ride={target:requested,phase:'closing',start:0,reopen:(door?.target||0)>0};door?.setAngle(0,true);invalidate();toast('Hissen stänger. Resan är en visuell illusion mellan plan '+floor+' och '+requested+'.');return true;
    }
    function setLights(value){lights=!!value;rebuildDisplay();}
    function tick(time){
      if(disposed)return false;let active=false;
      if(door&&lastTarget!==door.target){lastTarget=door.target;chime('door');}
      if(ride){active=true;if(ride.phase==='closing'&&(!door||door.degrees<.5)){ride.phase='travelling';ride.start=time;}
        if(ride.phase==='travelling'){
          if(door&&door.target!==0)door.setAngle(0,false);
          if(time-ride.start>=3200){floor=ride.target;const reopen=ride.reopen;ride=null;rebuildDisplay();chime('arrive');if(reopen)door?.setAngle(90,true);toast('Plan '+floor+' · visuell resa klar. Kabinen ligger kvar på samma modellkoordinater.');}
        }
      }
      return active;
    }
    function draw3D(options={}){
      if(!gl||disposed)return;const mode=options.mode||state.mode,roof=options.roof||state.roof,eye=options.eye||state.eye||[0,4,0],inside=contains(eye[0],eye[2])&&eye[1]<bounds.height;
      gl.uniform1i(U.instanced,0);gl.uniformMatrix4fv(U.model,false,I4);gl.uniformMatrix3fv(U.normal,false,I3);gl.uniform1f(U.clip,mode==='plan'?1.15:100);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);
      for(const p of resources){
        if((p.layer==='ceiling'||p.layer==='lamp')&&(mode==='plan'||(roof==='open'&&mode!=='walk'&&!inside)))continue;
        const c=colors[p.mat],dim=lights?1:.58,color=p.layer==='floor'?[...c]:[c[0]*dim,c[1]*dim,c[2]*dim,c[3]];
        gl.uniform4fv(U.color,color);gl.uniform1f(U.rough,p.mat.startsWith('steel')?.37:.73);gl.uniform1f(U.metal,p.mat.startsWith('steel')?.58:0);gl.uniform1i(U.type,p.mat==='cabinLamp'||p.mat==='cabinDigit'?2:0);gl.bindVertexArray(p.vao);gl.drawArrays(gl.TRIANGLES,0,p.count);
      }
      gl.uniform1i(U.type,0);
    }
    function drawHUD(ctx,project,mode=state.mode){
      if(!ctx||!project)return;
      if(mode==='plan'){
        const points=[[bounds.west,bounds.north],[bounds.east,bounds.north],[bounds.east,bounds.south],[bounds.west,bounds.south]].map(([x,z])=>project([x,.03,z]));if(points.some(p=>!p))return;
        ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle='rgba(45,61,66,.92)';ctx.fill();ctx.strokeStyle='#829499';ctx.lineWidth=3;ctx.stroke();
        const a=project([portal.west,.05,portal.z]),b=project([portal.east,.05,portal.z]);if(a&&b){ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineWidth=5;ctx.strokeStyle=portalOpen(door?.degrees||0)?'#87bd9c':'#c6a15a';ctx.stroke();}
        const c=project([1.04,.05,-5.38]);if(c){ctx.fillStyle='#edf3f0';ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.fillText('HISS 12 · PLAN '+floor,c[0],c[1]);ctx.font='10px system-ui';ctx.fillStyle='#b9cccc';ctx.fillText('ca 2,84 × 2,85 m',c[0],c[1]+17);}ctx.restore();
      }
      if(ride){const p=project([1.57,2.60,-6.54]);if(p){ctx.save();ctx.textAlign='center';ctx.font='600 13px system-ui';ctx.fillStyle='#d7fff0';ctx.fillText(ride.phase==='closing'?'STÄNGER':(ride.target>floor?'↑ ':'↓ ')+'PLAN '+ride.target+' · VISUELL RESA',p[0],p[1]);ctx.restore();}}
    }
    function snapshot(){return {version:1,floor,lights,sound};}
    function restore(v={}){ride=null;floor=v.floor===5?5:3;lights=v.lights!==false;rebuildDisplay();invalidate();}
    function canWalk(x,z,radius=.18,from){
      const angle=door?.degrees||0,direction=door?.direction||1;
      if(!isNavigable(x,z,radius,angle,direction))return false;
      if(from){const fx=Array.isArray(from)?from[0]:from.x,fz=Array.isArray(from)?from.length===3?from[2]:from[1]:from.z,steps=Math.ceil(Math.hypot(x-fx,z-fz)/Math.max(.04,radius*.5));for(let i=1;i<steps;i++)if(!isNavigable(fx+(x-fx)*i/steps,fz+(z-fz)*i/steps,radius,angle,direction))return false;}
      return true;
    }
    upload();
    return {bounds,portal,spawn,isNavigable,draw3D,drawHUD,tick,setFloor,setLights,setSound,snapshot,restore,canWalk,portalOpen:(r=.22)=>portalOpen(door?.degrees||0,r),doorwayBlocked:(x,z,r=.22)=>doorwayBlocked(x,z,r,door?.degrees||0,door?.direction||1),exportGeometry:()=>batches,get floor(){return floor},get lights(){return lights},get sound(){return sound},get travelling(){return !!ride},get status(){return ride?ride.phase==='closing'?'Stänger dörren':'Visuell resa → plan '+ride.target:'Plan '+floor},dispose(){disposed=true;disposeResources();if(audio)audio.close();}};
  }
  const api={bounds,roomBounds,portal,spawn,contains,portalOpen,doorwayBlocked,isNavigable,buildGeometry,colors,createFreightElevator};
  root.FreightElevatorGeometry=api;root.createFreightElevator=createFreightElevator;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
