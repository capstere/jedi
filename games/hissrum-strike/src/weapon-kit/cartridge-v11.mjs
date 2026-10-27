/** Private game derivative of Generisk Cartridge QC v11.3.
 * Source: capstere/the@890d9e62e133390d74e2415cd02eb920f47c4fad,
 * cartridge-qc/app/Generisk_Cartridge_QC_v11.3.html.
 * Reuses the two model builders, sampled curves, measured contours, 13 ports,
 * PCR outline, blue foot and lid pivot. No QC UI/data/storage/import logic.
 * Redistribution is NOT cleared: see assets/fps/cartridge-v11.provenance.json.
 * Game changes: metres, reduced tessellation, shared material batches, LOD,
 * opaque frosted shell and a new label reading exactly Counter Analyst.
 */
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
export const CARTRIDGE_LABEL = 'Counter Analyst';
export const CARTRIDGE_SOURCE = Object.freeze({version:'11.3',commit:'890d9e62e133390d74e2415cd02eb920f47c4fad',units:'mm',metresPerUnit:.001,chimneys:13,hinges:2,publicDistributionApproved:false});

function createCartridge(T,assets,detail){
 const root=new T.Group();root.name='Generisk cartridge';
 const parts={};for(const k of ['body','lid','base','pcr']){parts[k]=new T.Group();parts[k].name=k;root.add(parts[k]);}
 const mat=(color,roughness=.4,other={})=>new T.MeshPhysicalMaterial({color,roughness,metalness:0,clearcoat:.18,clearcoatRoughness:.35,envMapIntensity:.36,...other});
 const M={blue:mat('#0072c6',.48),rim:mat('#0878ca',.44),darkBlue:mat('#0061ae',.52),milk:mat('#eef0e9',.38,{clearcoat:.32,transparent:true,opacity:.92,depthWrite:false,transmission:0}),white:mat('#f5f6ef',.48),seam:mat('#ccd4d4',.39),clear:mat('#e9f4f5',.17,{transparent:true,opacity:.17,depthWrite:false,side:T.DoubleSide,clearcoat:1}),edge:mat('#e8f1ee',.2,{transparent:true,opacity:.78,clearcoat:1}),film:mat('#ecf6f8',.28,{transparent:true,opacity:.085,depthWrite:false,side:T.DoubleSide}),dark:mat('#1e3543',.6),bottom:mat('#d8e1e0',.22,{transparent:true,opacity:.65,depthWrite:false}),groove:mat('#0567ba',.52)};
 const meshes=[];function add(g,geo,m,name){if(detail.omit.test(name)){geo.dispose();return new T.Object3D();}const o=new T.Mesh(geo,m);o.name=name;o.castShadow=true;o.receiveShadow=true;o.userData.part=g.name;g.add(o);meshes.push(o);return o;}
 function path(pts){const p=new T.Shape();p.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)p.lineTo(...pts[i]);p.closePath();return p;}
 function hole(pts){const p=new T.Path();p.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)p.lineTo(...pts[i]);p.closePath();return p;}
 function rr(x,y,w,h,r){const s=new T.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
 function circle(x,z,r){const p=new T.Path();p.absarc(x,z,r,0,Math.PI*2,true);return p;}
 function extrudeY(g,s,y,h,m,name,bevel=.12){const geo=new T.ExtrudeGeometry(s,{depth:h,steps:1,curveSegments:detail.curves,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1});geo.rotateX(Math.PI/2);geo.translate(0,y+h,0);return add(g,geo,m,name);}
 function box(g,x,y,z,w,h,d,m,name,r=.1){let geo;if(r>0){geo=new T.ExtrudeGeometry(rr(-w/2,-h/2,w,h,r),{depth:Math.max(.01,d-2*r),curveSegments:detail.curves,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,steps:1});geo.translate(0,0,-d/2+r);}else geo=new T.BoxGeometry(w,h,d);const o=add(g,geo,m,name);o.position.set(x,y,z);return o;}
 function cyl(g,x,y,z,r,h,m,name,r2=r){const o=add(g,new T.CylinderGeometry(r,r2,h,detail.sides,1,false),m,name);o.position.set(x,y,z);return o;}
 function tor(g,x,y,z,r,t,m,name){const o=add(g,new T.TorusGeometry(r,t,4,detail.sides),m,name);o.rotation.x=Math.PI/2;o.position.set(x,y,z);return o;}
 function line(g,pts,r,m,name,straight=false){let curve;if(straight){curve=new T.CurvePath();for(let i=1;i<pts.length;i++)curve.add(new T.LineCurve3(new T.Vector3(...pts[i-1]),new T.Vector3(...pts[i])));}else curve=new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v)),false,'centripetal');return add(g,new T.TubeGeometry(curve,Math.min(detail.lineSegments,Math.max(4,pts.length*2)),r,4,false),m,name);}
 function outline(){const s=new T.Shape();s.moveTo(-20,-22.7);s.lineTo(20,-22.7);s.quadraticCurveTo(23,-22.7,23,-19.7);s.bezierCurveTo(23,-6,21,-2,22,5);s.bezierCurveTo(22,10,26,15,26,17);s.quadraticCurveTo(26,20,21,21);s.quadraticCurveTo(0,25,-21,21);s.quadraticCurveTo(-26,20,-26,17);s.bezierCurveTo(-26,15,-22,10,-22,5);s.bezierCurveTo(-21,-2,-23,-6,-23,-19.7);s.quadraticCurveTo(-23,-22.7,-20,-22.7);return s;}
 // Softly tapered shell; curved front, radiused corners and a flatter rear.
 const op=outline().getPoints(detail.curves);if(op[0].equals(op.at(-1)))op.pop();
 const pos=[],uv=[],idx=[];const levels=[[15.6,.84],[16.3,.865],[18,.87],[66.8,.94],[69,.95],[70,.95]];
 for(let j=0;j<levels.length;j++){const [y,sc]=levels[j];for(let i=0;i<=op.length;i++){let p=op[i%op.length];pos.push(p.x*sc,y,p.y*sc*.92);uv.push(i/op.length,j/(levels.length-1));}}
 for(let j=0;j<levels.length-1;j++)for(let i=0;i<op.length;i++){let a=j*(op.length+1)+i,b=a+op.length+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const shell=add(parts.body,geo,M.milk,'Tapered translucent-white shell');shell.material.side=T.DoubleSide;
 // Small molding seams and four raised corner strips.
 for(let sc of [.945]){const edgePts=op.map(p=>[p.x*sc,69.8,p.y*sc*.92]);edgePts.push(edgePts[0]);line(parts.body,edgePts,.23,M.white,'Upper shell lip');}
 const lo=op.map(p=>[p.x*.875,16.2,p.y*.875*.92]);lo.push(lo[0]);line(parts.body,lo,.18,M.seam,'Lower shell seam');
 for(const sign of [-1,1])for(const back of [-1,1]){const target=new T.Vector2(sign*23,back<0?-20:19),p=op.reduce((a,b)=>a.distanceTo(target)<b.distanceTo(target)?a:b);line(parts.body,[[p.x*.87,17.1,p.y*.87*.92],[p.x*.907,43,p.y*.907*.92],[p.x*.95,69.2,p.y*.95*.92]],.19,M.white,'Rounded vertical corner bead');}
 // Back chamber divisions are surface cues from the photos, not an invented interior.
 for(const x of [-12,12])line(parts.body,[[x*.89,17,-18.24],[x*.94,42,-19.01],[x,68,-19.84]],.10,M.seam,'Rear molding line');
 // Curved generic label with the same UV geometry and alpha silhouette as v11.
 if(assets.labelMaterial){const lm=assets.labelMaterial;const lp=[],lu=[],li=[];const nx=detail.labelSegments,ny=2;
  for(let j=0;j<=ny;j++){let v=j/ny,y=17.7+v*49.7,half=18.4+v*1.4,sc=.87+(y-18)/(66.8-18)*.07;for(let i=0;i<=nx;i++){let u=i/nx,x=(u-.5)*2*half,z=-100;for(let k=0;k<op.length;k++){const a=op[k],b=op[(k+1)%op.length],ax=a.x*sc,bx=b.x*sc;if((x>=Math.min(ax,bx))&&(x<=Math.max(ax,bx))&&Math.abs(bx-ax)>.00001){const t=(x-ax)/(bx-ax);z=Math.max(z,(a.y+(b.y-a.y)*t)*sc*.92);}}lp.push(x,y,z+.20);lu.push(u,v);}}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let a=j*(nx+1)+i,b=a+nx+1;li.push(a,a+1,b,a+1,b+1,b);}
  const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lp,3));lg.setAttribute('uv',new T.Float32BufferAttribute(lu,2));lg.setIndex(li);lg.computeVertexNormals();add(parts.body,lg,lm,'Counter Analyst label');
 }
 // Retained photo-derived underside assembly, converted with body and PCR.
 const valve=new T.Group();valve.name='base';parts.base.add(valve);
 // Exposed underside assembly, with stepped transparent rings, bosses and eccentric feature.
 cyl(valve,0,2.4,1.2,13.9,2.5,M.bottom,'Valve body exposed underside');cyl(valve,0,3.5,1.2,13.2,1.9,M.seam,'Valve recess back');
 for(const [r,y,t] of [[13.8,.82,.32],[12.9,.8,.18],[10.2,.72,.20],[8.3,.62,.34],[6.7,.55,.18],[5.7,.49,.28]])tor(valve,0,y,1.2,r,t,M.edge,'Concentric underside molding');
 cyl(valve,0,.65,1.2,5.6,.25,M.bottom,'Central frosted valve disc');
 for(let i=0;i<8;i++){const a=i*Math.PI/4+.1,x=Math.sin(a)*11.6,z=1.2+Math.cos(a)*11.6;tor(valve,x,.58,z,.9,.13,M.edge,'Underside molded boss');}
 tor(valve,8.9,.5,1.3,1.6,.27,M.edge,'Eccentric valve detail');cyl(valve,8.9,.75,1.3,.92,.12,M.dark,'Eccentric recess');
 box(valve,0,.52,10.6,.8,.42,4.5,M.edge,'Underside radial key',.08);
 for(let i=0;i<12;i++){const a=i*Math.PI/6+.15;line(valve,[[Math.sin(a)*10.3,.67,1.2+Math.cos(a)*10.3],[Math.sin(a)*12.9,.67,1.2+Math.cos(a)*12.9]],.09,M.edge,'Fine radial underside rib',true);}
 for(let i=0;i<4;i++){const a=i*Math.PI/2;const o=box(valve,Math.sin(a)*13.6,.67,1.2+Math.cos(a)*13.6,1.1,.55,1.4,M.edge,'Outer valve registration tab',.1);o.rotation.y=a;}
 const frosted=add(valve,new T.SphereGeometry(5.4,detail.sides,4),M.film,'Frosted central underside dome');frosted.scale.y=.05;frosted.position.set(0,.42,1.2);

 // PCR mount: U-shaped blue saddle centered on the back, upright + flat clear tube.
 line(parts.pcr,[[-5.4,15.8,-21.0],[-5.4,29.7,-21.0],[-4,34.4,-21.0],[0,35.8,-21.0],[4,34.4,-21.0],[5.4,29.7,-21.0],[5.4,15.8,-21.0]],.38,M.edge,'Rear body mounting bead (approximation)');
 // Tube lies in the YZ plane. Its long axis is scaled from the side-view photo; the body dimensions remain relative.
 const pcrLengthScale=1;
 const outer=[[0,16.9],[11.9,16.9],[20.2,25.3],[11.9,33.7],[0,33.7]];
 const diamond=[[10.7,25.3],[14.6,29.5],[18.6,25.3],[14.6,21.1]];
 const ps=path(outer);ps.holes.push(hole(diamond));const pg=new T.ExtrudeGeometry(ps,{depth:.92,steps:1,bevelEnabled:true,bevelSize:.20,bevelThickness:.20,bevelSegments:1});
 // local (u,v,w) -> world (w-.46,v,-18.3-u)
 const pa=pg.attributes.position;for(let i=0;i<pa.count;i++){const u=pa.getX(i),v=pa.getY(i),w=pa.getZ(i);pa.setXYZ(i,w-.46,v,-18.3-u);}pg.computeVertexNormals();add(parts.pcr,pg,M.clear,'Thin pentagonal reaction tube with diamond opening');
 const wline=(pts,r,name,side=0)=>line(parts.pcr,pts.map(p=>[side,p[1],-18.3-p[0]*pcrLengthScale]),r,M.edge,name,true);
 const closed=outer.concat([outer[0]]);for(const side of [-.64,.64]){wline(closed,.21,'PCR peripheral bead',side);wline(diamond.concat([diamond[0]]),.17,'Diamond aperture bead',side);wline([[.9,18.1],[11.3,18.1],[18.3,25.3],[11.3,32.5],[.9,32.5]],.11,'Inner peripheral molding',side);}
 wline([[0,25.3],[10.5,25.3]],.25,'Horizontal PCR web');wline([[4.1,18.0],[4.1,32.6]],.21,'Vertical PCR web');wline([[7.0,18.0],[7.0,32.6]],.18,'Second PCR web');
 wline([[7.2,25.3],[11.7,30.1]],.23,'Upper diagonal web');wline([[7.2,25.3],[11.7,20.5]],.23,'Lower diagonal web');
 for(let i=0;i<6;i++)for(const sign of [-1,1]){const u=7.9+i*.71,v=25.3+sign*(1.4+i*.71);const tri=path([[u-.36,v],[u+.37,v+sign*.1],[u+.3,v-sign*.62]]);const tg=new T.ExtrudeGeometry(tri,{depth:1.1,bevelEnabled:false});const p=tg.attributes.position;for(let j=0;j<p.count;j++){const a=p.getX(j),b=p.getY(j),c=p.getZ(j);p.setXYZ(j,c-.55,b,-18.3-a*pcrLengthScale);}tg.computeVertexNormals();add(parts.pcr,tg,M.edge,'Serrated PCR edge tooth');}
 const tip=add(parts.pcr,new T.SphereGeometry(.55,detail.sides,4),M.edge,'Small distal tube tab');tip.position.set(0,25.3,-39.3);tip.scale.set(.9,1,1.4);
 wline([[0,17.3],[0,33.4]],.45,'PCR proximal mounting edge');
 // A single dimensional conversion for all inherited, unmeasured surfaces.
 const legacyMmPerUnit=1.650*25.4/52;
 parts.body.scale.setScalar(legacyMmPerUnit);
 valve.scale.setScalar(legacyMmPerUnit);
 parts.pcr.scale.setScalar(legacyMmPerUnit);
 parts.pcr.position.z=2.6*legacyMmPerUnit;
 // Very transparent surfaces must not cast opaque shadows onto the nominal body.
 for(const o of meshes)if(o.material.transparent){o.castShadow=false;o.receiveShadow=false;}

 return {root,parts,meshes,materials:M};
}

/* v11.2 measured visible components. All numbers here are mm.
 * Drawings are inch based: I() is the sole conversion for specified dimensions.
 * 302-1455 C pp1-4: fixed deck + movable cap, 13 identified chimneys, two living hinges.
 * 300-8788 CFG-01 L pp1-3: footprint, opening, fork and visible retaining features.
 * Missing CAD/visual aids are NOT reconstructed. Angular port layout, unmapped curves,
 * assembled fit, leaf opening angle and film remain conservative visual approximations.
 */
function addMeasuredV112(T,model,isOpen,detail){
 const {parts,meshes,materials:M}=model, I=v=>v*25.4;
 const add=(g,geo,mat,name,metadata={})=>{if(detail.omit.test(name)){geo.dispose();return new T.Object3D();}const o=new T.Mesh(geo,mat);o.name=name;o.userData={part:g.userData.part||g.name,...metadata};o.castShadow=!mat.transparent;o.receiveShadow=!mat.transparent;g.add(o);meshes.push(o);return o;};
 function poly(points){const s=new T.Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();return s;}
 function circle(x,z,r){const p=new T.Path();p.absarc(x,z,r,0,Math.PI*2,true);return p;}
 function plate(g,s,y,h,mat,name,bevel=0){const geo=new T.ExtrudeGeometry(s,{depth:h,steps:1,curveSegments:detail.curves,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1});geo.rotateX(Math.PI/2);geo.translate(0,y+h,0);return add(g,geo,mat,name);}
 function block(g,x,y,z,w,h,d,mat,name){const o=add(g,new T.BoxGeometry(w,h,d),mat,name);o.position.set(x,y,z);return o;}
 function ring(g,x,y,z,r,t,mat,name){const o=add(g,new T.TorusGeometry(r,t,4,detail.sides),mat,name);o.rotation.x=Math.PI/2;o.position.set(x,y,z);return o;}
 function tube(g,points,r,mat,name){const c=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');return add(g,new T.TubeGeometry(c,Math.min(detail.lineSegments,Math.max(4,points.length*2)),r,4,false),mat,name);}
 function roundedRect(x,z,w,h,r){const s=new T.Shape();s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);s.lineTo(x+w,z+h-r);s.quadraticCurveTo(x+w,z+h,x+w-r,z+h);s.lineTo(x+r,z+h);s.quadraticCurveTo(x,z+h,x,z+h-r);s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;}
 function lathe(g,profile,x,y,z,mat,name,metadata={}){const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),detail.sides);geo.translate(x,y,z);return add(g,geo,mat,name,metadata);}

 const deckY=57.1, deckBottom=56.28, hingeZ=-I(.654), hingeY=57.12;
 const capLow=58.14, capThickness=I(.050), capTop=capLow+capThickness;
 function outline(cap=false){
  const w=I(cap?1.658:1.650)/2, back=I(1.255)/2, front=I(cap?.714:.711);
  const s=new T.Shape();s.moveTo(-back,hingeZ+.1);s.quadraticCurveTo(0,hingeZ+.52,back,hingeZ+.1);
  s.quadraticCurveTo(back+1.45,hingeZ+.1,back+1.75,hingeZ+1.5);
  s.bezierCurveTo(back+2.3,-6,back+1.0,1.5,back+2.5,6.5);
  s.bezierCurveTo(back+3.0,9,w,11,w,13.25);
  s.quadraticCurveTo(w,15.25,w-3.2,16.05);s.quadraticCurveTo(0,2*front-16.05,-w+3.2,16.05);
  s.quadraticCurveTo(-w,15.25,-w,13.25);s.bezierCurveTo(-w,11,-back-3.0,9,-back-2.5,6.5);
  s.bezierCurveTo(-back-1.0,1.5,-back-2.3,-6,-back-1.75,hingeZ+1.5);
  s.quadraticCurveTo(-back-1.45,hingeZ+.1,-back,hingeZ+.1);return s;
 }
 // Identified angular layout follows the fixed-deck top view, p2. Angles are
 // approximate (not specified in this drawing); the .660 BC is specified.
 const portLayout=[['1',9],['2a',36],['3',63],['4',90],['5',117],['6',144],['8a',174],['7',204],['8b',231],['9',258],['10',285],['11',312],['2b',339]];
 const ports=portLayout.map(([id,deg])=>{const a=deg*Math.PI/180;return {id,a,x:I(.330)*Math.sin(a),z:I(.330)*Math.cos(a),bore:I(id==='8a'?.042:['1','2a','2b'].includes(id)?.067:.059)/2};});
 const socket={x:I(.470),z:I(.375),r:I(.360)/2};
 function keyhole(){const p=new T.Path(),r=socket.r,x=socket.x,z=socket.z,neck=1.15,a=Math.asin(neck/r);p.absarc(x,z,r,-Math.PI/2+a,Math.PI*1.5-a,false);p.lineTo(x-neck,z-r-1.4);p.quadraticCurveTo(x-neck,z-r-2.4,x,z-r-2.4);p.quadraticCurveTo(x+neck,z-r-2.4,x+neck,z-r-1.4);p.closePath();return p;}
 const fixed=new T.Group();fixed.name='Fixed top';fixed.userData.part='lid';parts.lid.add(fixed);
 const deck=outline();ports.forEach(p=>deck.holes.push(circle(p.x,p.z,p.bore)));deck.holes.push(circle(0,0,I(.164)/2));deck.holes.push(keyhole());
 plate(fixed,deck,deckBottom,deckY-deckBottom,M.blue,'Fixed perforated deck');
 // Hollow stems, no dark discs closing the apertures. The visible basal fillet
 // is simplified where adjacent R.045 blends merge (associated CAD unavailable).
 for(const p of ports){
  const ro=I(.113)/2,rb=1.94,hi=I(.098),lo=I(.092),r=p.bore;
  const profile=[[r,-.82],[rb,-.82],[rb,0],[1.82,.10],[1.61,.38],[ro+.035,.83],[ro,1.12],[ro,hi],[ro-.07,hi],[r+.04,lo+.02],[r,lo-.03],[r,-.82]];
  const o=lathe(fixed,profile,p.x,deckY,p.z,M.blue,'Chimney '+p.id,{feature:'chimney',chimneyId:p.id});
  // Aperture edges are geometry; mould blue stays clean and nominal.
 }
 const centralR=I(.335)/2, centralHole=I(.164)/2;
 lathe(fixed,[[centralHole,-.82],[centralR,-.82],[centralR,.5],[centralR,2.49],[centralHole+.12,2.49],[centralHole,2.3],[centralHole,-.82]],0,deckY,0,M.blue,'Fixed central opening');
 // Four small flush moulding witnesses; no brands, IDs or black gate marks.
 for(const [x,z] of [[-14.0,-12.5],[14,-12.5],[-17.8,13.1],[18.1,13.0]])ring(fixed,x,deckY+.012,z,1.34,.035,M.rim,'Fixed mould witness');
 const perimeter=outline().getPoints(detail.curves).map(p=>[p.x,deckBottom+.16,p.y]);tube(fixed,perimeter,.11,M.darkBlue,'Fixed lower perimeter seam');

 const leaf=new T.Group();leaf.name='Movable cap';leaf.userData.part='lid';leaf.userData.feature='movableCap';parts.lid.add(leaf);
 const cap=outline(true);ports.forEach(p=>cap.holes.push(circle(p.x,p.z,I(.133)/2)));cap.holes.push(circle(0,0,I(.358)/2));
 plate(leaf,cap,capLow,capThickness,M.blue,'Perforated cap plate');
 // Shallow underside circular relief and central socket are distinct from the
 // outside of the cap. No duplicate chimneys are attached to the moving leaf.
 const annulus=new T.Shape(),ar=I(.890)/2,cr=I(.350)/2,sd=Math.hypot(socket.x,socket.z),sa=Math.atan2(socket.z,socket.x),da=Math.acos((ar*ar+sd*sd-cr*cr)/(2*ar*sd));
 annulus.absarc(0,0,ar,sa+da,sa-da+2*Math.PI,false);
 const a1=Math.atan2(ar*Math.sin(sa-da)-socket.z,ar*Math.cos(sa-da)-socket.x),a2=Math.atan2(ar*Math.sin(sa+da)-socket.z,ar*Math.cos(sa+da)-socket.x);
 annulus.absarc(socket.x,socket.z,cr,a1,a2,true);annulus.closePath();annulus.holes.push(circle(0,0,I(.426)/2));ports.forEach(p=>annulus.holes.push(circle(p.x,p.z,I(.133)/2)));
 plate(leaf,annulus,capLow-.30,.30,M.blue,'Cap inner annular relief');
 // B-B is a BLIND cup: its bottom is the cap plate, so no extra corner hole
 // is visible on the closed outer face (p1 CLOSED / p2 section B-B).
 lathe(leaf,[[cr-.46,-I(.105)],[cr,-I(.105)],[cr,0],[cr-.46,0],[cr-.46,-I(.105)]],socket.x,capLow,socket.z,M.blue,'Cap blind corner cup');
 const skirt=outline(true);skirt.holes.push(poly(outline(true).getPoints(detail.curves).map(p=>[p.x*.966,p.y*.966])));
 plate(leaf,skirt,deckY+.045,capLow-deckY-.045,M.blue,'Cap peripheral downstand');
 const innerEdge=outline(true).getPoints(detail.curves).map(p=>[p.x*.965,capLow-.35,p.y*.965]);tube(leaf,innerEdge,.23,M.blue,'Cap inner peripheral rim');
 for(const side of [-1,1])tube(leaf,[[side*14.6,capLow-.30,-13.0],[side*15.2,capLow-.38,-6],[side*16.2,capLow-.38,2.5],[side*17.7,capLow-.3,9.8]],.25,M.blue,'Cap inner reinforcing rib '+side);
 // Outer raised surround and front latch remain features of this same leaf.
 ring(leaf,0,capTop+.15,0,13.15,.17,M.blue,'Cap outer circular surround');
 for(const [x,z] of [[-14.2,-12.8],[14.2,-12.8],[-17.8,13.2],[17.8,13.2]])ring(leaf,x,capTop+.016,z,1.4,.035,M.rim,'Cap mould witness');
 tube(leaf,[[-8.5,capTop+.06,16.75],[0,capTop+.08,17.82],[8.5,capTop+.06,16.75]],.32,M.blue,'Cap front latch lip');
 // Thin transparent film follows the cap. One planar surface, no coincident
 // cylinder caps / double-sided overlap, and deliberately excluded from picking.
 const filmGeo=new T.CircleGeometry(12.94,detail.sides);filmGeo.rotateX(-Math.PI/2);filmGeo.translate(0,capTop+.085,0);
 const film=add(leaf,filmGeo,M.film,'Film Seal (visual approximation)',{pickable:false});film.castShadow=false;film.receiveShadow=false;film.renderOrder=4;
 ring(leaf,0,capTop+.09,0,12.99,.045,M.clear,'Film perimeter');
 for(const [id,x] of [[1,-13.65],[2,13.65]]){
  // Living hinges, not pin-and-barrel hinges. The flexible bend is displayed
  // schematically; angle is a viewing choice, not a material deformation model.
  const g=new T.Group();g.name='Living hinge '+id;g.userData.part='lid';g.userData.feature='livingHinge';g.userData.hingeId=id;fixed.add(g);
  block(g,x,hingeY-.03,hingeZ+.26,3.05,I(.010),.74,M.blue,'Hinge '+id+' fixed web');
  const strap=poly([[-1.525,hingeY-.03],[1.525,hingeY-.03],[1.525,capLow+.12],[-1.525,capLow+.12]]);
  const geo=new T.ExtrudeGeometry(strap,{depth:.28,bevelEnabled:false});geo.translate(x,0,hingeZ-.14);add(leaf,geo,M.blue,'Hinge '+id+' moving web');
 }
 // Rebase all moving geometry exactly once. Closed and open files differ only
 // by this rigid transform (plus camera/UI/storage configuration).
 for(const o of leaf.children){o.position.y-=hingeY;o.position.z-=hingeZ;}
 leaf.position.set(0,hingeY,hingeZ);leaf.rotation.x=isOpen?-105*Math.PI/180:0;
 model.leaf=leaf;model.fixedTop=fixed;model.chimneys=ports;

 // Nominal foot footprint. Arc transitions are visual approximations; stated
 // extrema 1.594 x 1.339 and central opening .855 are retained without bevel growth.
 const halfW=I(1.594)/2, front=I(.674),back=front-I(1.339),forkZ=back+.75,topY=I(.526);
 function footOutline(){const s=new T.Shape();s.moveTo(-halfW+1.27,back);s.lineTo(halfW-1.27,back);s.quadraticCurveTo(halfW,back,halfW,back+1.27);s.lineTo(halfW,front-3.0);s.quadraticCurveTo(halfW,front-1.4,halfW-2,front-1.25);s.quadraticCurveTo(0,front+1.25,-halfW+2,front-1.25);s.quadraticCurveTo(-halfW,front-1.4,-halfW,front-3);s.lineTo(-halfW,back+1.27);s.quadraticCurveTo(-halfW,back,-halfW+1.27,back);return s;}
 const base=parts.base;
 // Construct the lower flange as an outer wall strip with y-dependent real
 // notches, plus perforated upper/lower faces; notch walls close the voids.
 function flangeShape(frontHalf,backHalf){
  const s=new T.Shape();s.moveTo(-halfW+1.27,back);s.lineTo(-backHalf,back);s.lineTo(-backHalf,back+3.05);s.lineTo(backHalf,back+3.05);s.lineTo(backHalf,back);s.lineTo(halfW-1.27,back);s.quadraticCurveTo(halfW,back,halfW,back+1.27);s.lineTo(halfW,front-3);s.quadraticCurveTo(halfW,front-1.4,halfW-2,front-1.25);
  s.quadraticCurveTo(12,front,frontHalf,front);s.lineTo(frontHalf,front-3.1);s.lineTo(-frontHalf,front-3.1);s.lineTo(-frontHalf,front);s.quadraticCurveTo(-12,front,-halfW+2,front-1.25);s.quadraticCurveTo(-halfW,front-1.4,-halfW,front-3);s.lineTo(-halfW,back+1.27);s.quadraticCurveTo(-halfW,back,-halfW+1.27,back);
  return s;
 }
 const longGrooves=[-17.7,17.7];
 const snapAngles=[50.1,129.9,230.1,309.9].map(a=>a*Math.PI/180);
 function cuts(s){s.holes.push(circle(0,0,I(.855)/2));for(const x of longGrooves)s.holes.push(roundedRect(x-1.1,-10.6,2.2,22.9,1.0));for(const a of snapAngles){const cx=Math.sin(a)*12.9,cz=Math.cos(a)*12.9;const pts=[[-1.25,-2.10],[1.25,-2.10],[1.25,2.10],[-1.25,2.10]].map(([x,z])=>[cx+x*Math.cos(a)+z*Math.sin(a),cz-x*Math.sin(a)+z*Math.cos(a)]);s.holes.push(poly(pts));}return s;}
 // Smooth front arch and separate square rear notch, both cut through the
 // lower edge with a recessed rear wall. No layered coplanar solids.
 const notchFront=I(.291)/2,notchBack=I(.418)/2,flangeH=I(.150);
 plate(base,cuts(flangeShape(notchFront,notchBack)),0,flangeH,M.blue,'Foot flange with true front and rear notches');
 const archPts=[[-notchFront,flangeH],[notchFront,flangeH],[notchFront,0]];
 for(let i=1;i<=detail.sides;i++){const a=i*Math.PI/detail.sides;archPts.push([notchFront*Math.cos(a),2.5*Math.sin(a)]);}
 const archGeo=new T.ExtrudeGeometry(poly(archPts),{depth:3.10,steps:1,bevelEnabled:false});archGeo.translate(0,0,front-3.10);add(base,archGeo,M.blue,'Front arch roof and recessed walls');
 block(base,0,(2.54+flangeH)/2,back+3.05/2,2*notchBack,flangeH-2.54,3.05,M.blue,'Rear notch roof and recessed walls');
 for(const x of longGrooves)plate(base,roundedRect(x-1.15,-10.65,2.3,23,1.03),2.3,.18,M.blue,'Long recessed guide floor');
 // Hollow sloping collar with actual inner wall and rim. Uses a shared outline
 // at each height, no closed box or solid block under the body.
 const fp=footOutline().getPoints(detail.curves);if(fp[0].equals(fp.at(-1)))fp.pop();
 const vertices=[],indices=[];const levels=[[flangeH,.96],[flangeH+.55,.935],[topY-.40,.875],[topY,.87]];
 const n=fp.length;
 for(const [y,sc] of levels)for(const p of fp)vertices.push(p.x*sc,y,p.y*sc);
 for(const [y,sc] of levels)for(const p of fp)vertices.push(p.x*(sc-.035),y,p.y*(sc-.035));
 for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);const off=levels.length*n;indices.push(a+off,b+off,c+off,b+off,d+off,c+off);}
 for(let i=0;i<n;i++){const a=(levels.length-1)*n+i,b=(levels.length-1)*n+(i+1)%n,c=a+levels.length*n,d=b+levels.length*n;indices.push(a,c,b,b,c,d);}
 const collarGeo=new T.BufferGeometry();collarGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));collarGeo.setIndex(indices);collarGeo.computeVertexNormals();add(base,collarGeo,M.blue,'Hollow tapered foot collar');
 // Four blue retaining tongues sit in their recesses; the slots retain depth.
 for(let i=0;i<snapAngles.length;i++){const a=snapAngles[i],x=Math.sin(a)*12.9,z=Math.cos(a)*12.9;const o=block(base,x,2.55,z,1.0,1.5,3.9,M.blue,'Retaining tongue '+(i+1));o.rotation.y=a;}
 const shoulder=new T.Shape();shoulder.absarc(0,0,I(.972)/2,0,2*Math.PI,false);shoulder.holes.push(circle(0,0,I(.855)/2));plate(base,shoulder,3.2,1.8,M.blue,'Circular inner shoulder');
 // One connected blue fork with its mounting bridge. Reference widths .210
 // and .070 describe the top silhouette; unprovided fillet transitions remain
 // approximate. Back slot floor .467, collar .526, total height 1.110.
 const outer=I(.210)/2,inner=I(.070)/2,high=I(1.110),slotY=I(.467),armD=I(.065);
 const fork=new T.Shape();fork.moveTo(-5.05,7.45);fork.quadraticCurveTo(0,5.45,5.05,7.45);fork.lineTo(5.05,9.4);fork.quadraticCurveTo(3.9,10.2,outer,11.05);fork.lineTo(outer,high-.8);fork.quadraticCurveTo(outer-.28,high,outer-.65,high);fork.lineTo(inner,high-.86);fork.lineTo(inner,slotY);fork.lineTo(-inner,slotY);fork.lineTo(-inner,high-.86);fork.lineTo(-outer+.65,high);fork.quadraticCurveTo(-outer+.28,high,-outer,high-.8);fork.lineTo(-outer,11.05);fork.quadraticCurveTo(-3.9,10.2,-5.05,9.4);fork.closePath();
 const fg=new T.ExtrudeGeometry(fork,{depth:armD,steps:1,curveSegments:detail.curves,bevelEnabled:false});fg.translate(0,0,forkZ);add(base,fg,M.blue,'Integrated rear fork',{feature:'rearFork'});
 // Side bridges seat the fork into the collar, leaving the centre slot open.
 for(const s of [-1,1])block(base,s*3.25,9.4,forkZ+armD+1.0,2.7,3.6,2.2,M.blue,'Fork root bridge '+s);
 model.dimensions={units:'mm',legacyMmPerUnit:1.650*25.4/52,lidFixedWidth:I(1.650),capWidth:I(1.658),chimneyBC:I(.660),baseWidth:I(1.594),baseDepth:I(1.339),forkHeight:high,openingAngle:isOpen?105:0};
}


const detailProfiles = {
 near: {curves:4,sides:12,lineSegments:24,labelSegments:12,omit:/Fine radial underside rib|Underside molded boss|mould witness|Serrated PCR edge tooth|Film perimeter|Film Seal/},
 mid: {curves:2,sides:6,lineSegments:8,labelSegments:6,omit:/molding|mould witness|molded boss|corner bead| shell lip|shell seam|Film|Concentric|valve|Valve|underside|Underside|PCR edge tooth|peripheral bead|peripheral molding| PCR web|PCR web|mounting bead|perimeter seam|reinforcing rib|surround|guide floor|Retaining tongue|shoulder|Small distal|front latch lip|peripheral rim/}
};
let sharedMaterials;
const templates = new Map(), clusters = new Map();
function getMaterials(){
 if(sharedMaterials)return sharedMaterials;
 let map=null,atlas=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle='#f4f3e8';c.fillRect(0,0,512,512);c.fillStyle='#0b73bd';c.fillRect(0,20,512,35);
  c.fillStyle='#173546';c.font='600 49px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(CARTRIDGE_LABEL,256,232,480);
  c.strokeStyle='#b6c4c5';c.lineWidth=2;c.strokeRect(28,86,456,335);
  map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  // The far model uses one material: label on the left, an untextured white
  // swatch on the right multiplied by the inherited vertex colours.
  const sheet=document.createElement('canvas');sheet.width=1024;sheet.height=512;const a=sheet.getContext('2d');
  a.fillStyle='#ffffff';a.fillRect(0,0,1024,512);a.drawImage(canvas,0,0);
  atlas=new THREE.CanvasTexture(sheet);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
 }
 const mat=(color,roughness,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra});
 sharedMaterials={blue:mat('#0072c6',.48),milk:mat('#eef0e9',.38,{side:THREE.DoubleSide}),edge:mat('#ccd4d4',.39),clear:mat('#d8e8e9',.24,{side:THREE.DoubleSide}),label:mat(0xffffff,.78,{map}),mid:mat(0xffffff,.45,{vertexColors:true,side:THREE.DoubleSide}),far:mat(0xffffff,.45,{map:atlas,vertexColors:true,side:THREE.DoubleSide})};
 for(const [key,m]of Object.entries(sharedMaterials)){m.name=`v11.3-${key}`;m.userData.sharedCartridge=true;}
 return sharedMaterials;
}
function canonicalMaterial(original,model){
 const m=model.materials,shared=getMaterials();
 if(original===getMaterials().label)return shared.label;
 if([m.blue,m.rim,m.darkBlue,m.groove].includes(original))return shared.blue;
 if([m.milk,m.white].includes(original))return shared.milk;
 if([m.clear,m.film,m.edge,m.bottom].includes(original))return shared.clear;
 return shared.edge;
}
/** One immutable geometry set per LOD and lid pose, reused across every instance.
 * Metres are baked into the buffers; base sits at y=0 and label faces +Z.
 */
export function cartridgeGeometry({detail='near',open=false}={}){
 if(!detailProfiles[detail]&&detail!=='far')throw new Error(`Unknown cartridge detail: ${detail}`);
 const key=`${detail}:${!!open}`;if(templates.has(key))return templates.get(key);
 if(detail==='far'){const result=farGeometry(open);templates.set(key,result);return result;}
 const model=createCartridge(THREE,{labelMaterial:getMaterials().label},detailProfiles[detail]);
 addMeasuredV112(THREE,model,open,detailProfiles[detail]);model.root.updateMatrixWorld(true);
 const bins=new Map(),features=[];model.root.traverse(o=>{if(!o.isMesh&&o.userData.feature)features.push({name:o.name,...o.userData});});const sourceTriangles=model.meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
 for(const m of model.meshes){
  if(m.userData.feature||m.name==='Counter Analyst label'||m.name.includes('reaction tube'))features.push({name:m.name,...m.userData});
  let material=canonicalMaterial(m.material,model);const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
  g.applyMatrix4(m.matrixWorld);g.scale(.001,.001,.001);
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  if(detail==='mid'&&material!==getMaterials().label){const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<g.attributes.position.count;i++)material.color.toArray(colors,i*3);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));material=getMaterials().mid;}
  if(!bins.has(material))bins.set(material,[]);bins.get(material).push(g);m.geometry.dispose();
 }
 const parts=[];let triangles=0;
 for(const [material,geometries]of bins){const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometry.computeBoundingBox();geometry.userData.sharedCartridge=true;parts.push({geometry,material});triangles+=geometry.attributes.position.count/3;}
 for(const m of new Set(Object.values(model.materials)))m.dispose();
 const bounds=new THREE.Box3();for(const part of parts)bounds.union(part.geometry.boundingBox);
 const result={detail,open:!!open,parts,triangles,sourceTriangles,features,bounds,dimensions:{...model.dimensions,units:'mm',geometryUnits:'m',scale:.001},lidPivot:[0,.05712,-.0166116],label:CARTRIDGE_LABEL};templates.set(key,result);return result;
}
/** Cluster the existing medium mesh, never replace the inherited silhouette
 * with an unrelated box. Colour boundaries stay separate; duplicate/degenerate
 * triangles are removed. Exact template extrema and the curved label survive.
 * This level is used only when its projected extent is roughly twenty pixels. */
function simplifySurface(source,cellSize){
 const position=source.attributes.position,color=source.attributes.color,box=source.boundingBox,clusters=new Map(),mapping=[];
 for(let i=0;i<position.count;i++){
  const point=[position.getX(i),position.getY(i),position.getZ(i)],rgb=[color.getX(i),color.getY(i),color.getZ(i)];
  const key=point.map(v=>Math.round(v/cellSize)).join(':')+':'+rgb.join(':');
  let cluster=clusters.get(key);if(!cluster){cluster={index:clusters.size,sum:[0,0,0],count:0,color:rgb,extreme:[null,null,null]};clusters.set(key,cluster);}
  point.forEach((v,k)=>{cluster.sum[k]+=v;const axis=['x','y','z'][k];if(Math.abs(v-box.min[axis])<1e-8)cluster.extreme[k]=box.min[axis];else if(Math.abs(v-box.max[axis])<1e-8)cluster.extreme[k]=box.max[axis];});cluster.count++;mapping.push(cluster.index);
 }
 const vertices=[...clusters.values()].map(c=>c.sum.map((v,k)=>c.extreme[k]??v/c.count)),colours=[...clusters.values()].map(c=>c.color),seen=new Set(),positions=[],colors=[],uv=[];
 for(let i=0;i<mapping.length;i+=3){const ids=mapping.slice(i,i+3);if(new Set(ids).size!==3)continue;
  const key=[...ids].sort((a,b)=>a-b).join(':');if(seen.has(key))continue;seen.add(key);
  const [a,b,c]=ids.map(id=>vertices[id]),ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);if(area<1e-12)continue;
  for(const id of ids){positions.push(...vertices[id]);colors.push(...colours[id]);uv.push(.75,.5);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}
function farGeometry(open){
 const source=cartridgeGeometry({detail:'mid',open}),body=source.parts.find(p=>p.material!==getMaterials().label),label=source.parts.find(p=>p.material===getMaterials().label);
 const shell=simplifySurface(body.geometry,.0045),labelGeo=label.geometry.clone(),uv=labelGeo.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*.5);
 labelGeo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(labelGeo.attributes.position.count*3).fill(1),3));
 const geometry=mergeGeometries([shell,labelGeo],false);shell.dispose();labelGeo.dispose();geometry.computeBoundingSphere();geometry.computeBoundingBox();geometry.userData.sharedCartridge=true;
 return {...source,detail:'far',parts:[{geometry,material:getMaterials().far}],triangles:geometry.attributes.position.count/3,sourceTriangles:source.triangles,bounds:geometry.boundingBox.clone(),simplification:{method:'source-vertex-clustering',cellMetres:.0045,labelGeometryPreserved:true}};
}

export const CARTRIDGE_LOD_PIXELS=Object.freeze({near:56,mid:20,hysteresis:.18});
const projectedPoint=new THREE.Vector3(),viewModel=new THREE.Matrix4();
/** Maximum projected sample extent in actual render pixels. Each sample has its
 * own bounds so the middle of a large instancing cell cannot downgrade a close
 * cartridge. FOV, zoom, camera depth, parent transforms and viewport all count. */
export class CartridgeLOD extends THREE.LOD{
 constructor(samples){super();this.samples=samples.map(b=>b.clone());this.selectedLevel=null;}
 update(camera){
  const viewportHeight=camera.userData.cartridgeViewportHeight||1080,projection=camera.projectionMatrix.elements;
  viewModel.multiplyMatrices(camera.matrixWorldInverse,this.matrixWorld);let pixels=0;
  for(const box of this.samples){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,front=0,clipped=0;
   for(let i=0;i<8;i++){
    projectedPoint.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(viewModel);
    const depth=-projectedPoint.z;if(depth<=camera.near){clipped++;continue;}front++;
    const denominator=camera.isOrthographicCamera?1:depth,x=projectedPoint.x*projection[0]/denominator,y=projectedPoint.y*projection[5]/denominator;
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   }
   if(front&&clipped){pixels=Infinity;break;}
   if(front)pixels=Math.max(pixels,(x1-x0)*viewportHeight*(camera.aspect||1)*.5,(y1-y0)*viewportHeight*.5);
  }
  const {near,mid,hysteresis:h}=CARTRIDGE_LOD_PIXELS,thresholds=[near,mid];let next=this.selectedLevel;
  if(next===null)next=pixels>=near?0:pixels>=mid?1:2;
  else{while(next<2&&pixels<thresholds[next]*(1-h))next++;while(next>0&&pixels>thresholds[next-1]*(1+h))next--;}
  this.selectedLevel=next;this._currentLevel=next;this.userData.projectedPixels=pixels;this.userData.activeDetail=['near','mid','far'][next];
  this.levels.forEach((level,i)=>{level.object.visible=i===next;});
 }
}
function geometryGroup(template){const g=new THREE.Group();for(const {geometry,material}of template.parts){const m=new THREE.Mesh(geometry,material);m.castShadow=false;m.receiveShadow=true;g.add(m);}return g;}
/** Shared unscaled reference model, suitable for inspection or a single prop. */
export function makeCounterAnalystCartridge({open=false,lod=true}={}){
 const near=cartridgeGeometry({open}),root=lod?new CartridgeLOD([near.bounds]):new THREE.Group();root.name='Counter Analyst · Cartridge v11.3';
 if(lod){for(const [i,detail]of ['near','mid','far'].entries())root.addLevel(geometryGroup(cartridgeGeometry({detail,open})),i);}else root.add(geometryGroup(near));
 root.userData={cartridgeVersion:'11.3',label:CARTRIDGE_LABEL,privateDerivative:true,open:!!open,nominalScale:.001};return root;
}
const BAG_TRANSFORMS=[{x:-.064,y:-.122,z:-.014,yaw:Math.PI-.2,roll:-.12},{x:0,y:-.122,z:.016,yaw:Math.PI+.12,roll:.07},{x:.064,y:-.122,z:-.012,yaw:Math.PI-.09,roll:.16}];
const bagMatrix=p=>new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,p.yaw,p.roll)),new THREE.Vector3(1.35,1.35,1.35));
/** Three 1.35x visual scale samples; one shared rigid cluster per detail level.
 * One far draw, with no transparent cartridge surface inside the bag. */
export function makeBagCartridges(){
 const bounds=cartridgeGeometry().bounds,root=new CartridgeLOD(BAG_TRANSFORMS.map(p=>bounds.clone().applyMatrix4(bagMatrix(p))));root.name='bag-cartridges-v11.3';root.userData={cartridgeCount:3,cartridgeVersion:'11.3',label:CARTRIDGE_LABEL,privateDerivative:true};
 for(const [level,detail]of ['near','mid','far'].entries()){
  if(!clusters.has(detail)){
   const template=cartridgeGeometry({detail}),parts=[];
   for(const {geometry,material}of template.parts){
    const geos=BAG_TRANSFORMS.map(p=>geometry.clone().applyMatrix4(bagMatrix(p)));
    const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());merged.computeBoundingSphere();merged.userData.sharedCartridge=true;parts.push({geometry:merged,material});
   }
   clusters.set(detail,{parts});
  }
  root.addLevel(geometryGroup(clusters.get(detail)),level);
 }
 return root;
}
/** Only used when the entire Renderer is disposed, never between rounds. */
export function disposeCartridgeResources(){for(const template of [...templates.values(),...clusters.values()])for(const p of template.parts)p.geometry.dispose();templates.clear();clusters.clear();if(sharedMaterials){for(const mat of Object.values(sharedMaterials)){mat.map?.dispose();mat.dispose();}sharedMaterials=null;}}
