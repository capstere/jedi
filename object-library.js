/* Hissrum 12 Layout Studio V4 — locally generated equipment, no runtime dependencies.
 * Dimensions are metres. Objects originate at their bottom centre. V3 models are
 * delegated unchanged. V4 geometry is generated only for a distinct geometryKey;
 * moving or rotating equipment therefore never rebuilds a mesh.
 */
(function (root) {
  'use strict';
  const C = root.LayoutCore;
  if (!C) throw Error('LayoutCore måste läsas före object-library.js.');
  const oldGeometry = C.buildGeometry;
  const catalog = [
    {type:'largeWheelBin',name:'Stort svart sopkärl',short:'Stort kärl',category:'Avfall',w:.80,d:.90,h:1.18,color:'#353b3c',note:'Ungefär dubbel nominell kapacitet jämfört med V3-kärlet. Fyra hjul, lock och handtag; uppskattade yttermått.'},
    {type:'palletTruck',name:'Manuell palltruck',short:'Palltruck',category:'Transport',w:.55,d:1.55,h:1.22,color:'#e7b436',note:'Två gafflar, länkhjul och styrhandtag. Generisk manuell palltruck; uppskattade mått.'},
    {type:'cageCart',name:'Galler-tvättvagn',short:'Gallervagn',category:'Transport',w:.78,d:.72,h:1.52,color:'#cf7738',note:'Öppen galvaniserad gallerbur med orange botten och fyra hjul. Anpassningsbara yttermått.'},
    {type:'dryIceDrum',name:'Torr-is-tunna',short:'Torr-is',category:'Avfall',w:.50,d:.50,h:.90,color:'#7a9eaa',note:'Illustration av uppsamlingsplats, Ø 500 × 900 mm inklusive hjul. Överdelen har synliga öppningar; ingen teknisk förvaringskonstruktion.'},
    {type:'nitrogenTank',name:'Kvävetank',short:'Kväve',category:'Laboratorium',w:.34,d:.34,h:1.55,color:'#6a747a',params:{stand:true},note:'Generisk gasflaska med ventil, N₂-etikett och valbart golvstativ. Uppskattade mått.'},
    {type:'extinguisher',name:'Brandsläckare',short:'Släckare',category:'Väggmonterat',w:.24,d:.22,h:.60,color:'#c94337',placement:'either',note:'Röd släckare med slang och handtag. Kan stå på golvet eller placeras framför separat väggfäste.'},
    {type:'extinguisherBracket',name:'Väggfäste för brandsläckare',short:'Släckarfäste',category:'Väggmonterat',w:.18,d:.10,h:.36,color:'#3b4145',placement:'wall',note:'Separat väggplatta, nedre stöd och hållarband. Monteringshöjd avser fästets underkant.'},
    {type:'creformCart',name:'CREFORM referensvagn',short:'CREFORM-vagn',category:'Transport',w:.82,d:.52,h:.95,color:'#a4b3b8',note:'Tom vagn enligt byggbild: innermått 750 × 450 mm, höjd 950 mm; stödytor 220 och 720 mm. 28 mm rör, svarta kopplingar och två bromsar. Yttermått inkluderar kopplingarna.'},
    {type:'creformIptCart',name:'IPT CREFORM-vagn 750 × 450',short:'IPT-vagn 75×45',category:'Transport',w:.82,d:.52,h:1.12,color:'#1f3763',note:'Två rörhyllor med innermått 750 × 450 mm och totalhöjd 1120 mm. Hyllnivåer cirka 340 och 930 mm. Mörkblå rör, låga stopp och hyllrör tvärs över bredden enligt ritningen.'},
    {type:'creformTallRack',name:'CREFORM-vagn 900 × 600 × H1800',short:'CREFORM 90×60×180',category:'Transport',w:.97,d:.67,h:1.80,color:'#1f3763',note:'Tre nivåer enligt ritningen: öppen toppsektion med två rörhyllor på cirka 600 och 1200 mm. Alla ritmått avser invändiga mått 900 × 600 mm.'},
    {type:'creformLowRack',name:'CREFORM-vagn 800 × 400, 3 plan',short:'CREFORM 80×40',category:'Transport',w:.87,d:.47,h:1.04,color:'#1f3763',note:'Kompakt rörvagn med tre hyllplan. Invändigt 800 × 400 mm. Höjden är uppskattad utifrån 45 cm mellan plan eftersom totalhöjd inte framgår tydligt i underlaget.'},
    {type:'creformBuilder',name:'CREFORM Builder',short:'Egen CREFORM',category:'Förvaring',w:.87,d:.57,h:1.20,color:'#91a8a6',params:{levels:3,pipeDiameter:.028,wheels:4,brakes:2},note:'Parametrisk rörkonstruktion. Anpassa yttermått, hyllnivåer, rördiameter och hjul. Kopplingar skapas automatiskt.'},
    {type:'plasticBoxSmall',name:'Liten plastlåda',short:'Liten låda',category:'Förvaring',w:.30,d:.40,h:.18,color:'#bacbd0',note:'Öppen, halvtransparent låda 400 × 300 × 180 mm. Två 300 mm breda lådor ryms bredvid varandra på referensvagnen.'},
    {type:'plasticBoxLarge',name:'Stor plastlåda',short:'Stor låda',category:'Förvaring',w:.59,d:.39,h:.31,color:'#bacbd0',note:'Öppen, halvtransparent låda 590 × 390 × 310 mm. Lådorna är separata, flyttbara objekt.'},
    {type:'phoneArm',name:'Mobiltelefon på väggarm',short:'Mobilarm',category:'Väggmonterat',w:.26,d:.36,h:.30,color:'#5f6978',placement:'wall',params:{reach:.25,direction:0},note:'Väggplatta, ledad arm och telefonhållare. Skärmen visar ett generiskt meddelande: 4 Sample Points.'},
    {type:'gloveHolder',name:'Nitrilhandskar med hållare',short:'Handskar',category:'Väggmonterat',w:.27,d:.12,h:.17,color:'#588bb7',placement:'wall',params:{color:'blue'},note:'Kartong med synlig öppning i en väggmonterad metallhållare. Kartongfärgen kan ändras.'},
    {type:'sampleBag',name:'Sample Point-påse · 10',short:'10 cartridges',category:'Laboratorium',w:.24,d:.12,h:.09,color:'#d5dacc',note:'Exakt tio cartridges i en transparent påse. Privat härledd LOD-geometri från SPEL; får inte publiceras.'},
    {type:'carton',name:'Brun kartong',short:'Kartong',category:'Förvaring',w:.50,d:.36,h:.32,color:'#ba9263',params:{open:false},note:'Anpassningsbar kartong med tejp och viklinjer. Välj öppna flikar i objektsinställningarna.'},
    {type:'knife',name:'Kartongkniv',short:'Kniv',category:'Verktyg',w:.18,d:.035,h:.026,color:'#dd9b39',note:'Dekorativ säkerhetskniv med infällt, kort blad och greppytor.'},
    {type:'mallet',name:'Plasthammare',short:'Hammare',category:'Verktyg',w:.30,d:.11,h:.055,color:'#daae56',note:'Dekorativ verkstadshammare med plast-/gummihuvud.'},
    {type:'sign',name:'5S-skylt / etikett',short:'Skylt',category:'5S',w:.45,d:.014,h:.18,color:'#276c6a',placement:'either',params:{text:'IPT SAMPLE POINTS'},note:'Redigerbar skylttext. Kan monteras på vägg eller placeras på en stödyta.'}
  ];
  const oldCategories={pallet:'Transport',palletBins:'Avfall',fridge:'Förvaring',yellowBin:'Avfall',wheelBin:'Avfall',shelf:'Förvaring',cart:'Transport',material:'Transport'};
  for (const item of C.CATALOG) item.category = oldCategories[item.type] || 'Förvaring';
  for (const item of catalog) { C.CATALOG.push(item); C.byType[item.type]=item; }
  const newTypes = new Set(catalog.map(c=>c.type));
  Object.assign(C.MATS,{
    graphite:[.14,.17,.18,1],rubber:[.075,.09,.095,1],steelTube:[.69,.75,.77,1],
    creformBlue:[.12,.23,.44,1],creformBlueShadow:[.09,.18,.35,1],
    steelZinc:[.62,.69,.72,1],steelChrome:[.84,.88,.89,1],steelBrushed:[.53,.60,.64,1],
    orange:[.91,.40,.105,1],truckYellow:[.94,.67,.09,1],red:[.78,.105,.08,1],
    redLight:[.91,.18,.12,1],plastic:[.67,.77,.81,.29],plasticRim:[.74,.83,.86,.72],
    bagFilm:[.85,.91,.91,.14],bagFold:[.90,.94,.94,.27],gasGrey:[.40,.47,.51,1],
    gasGreen:[.22,.41,.34,1],brass:[.69,.53,.24,1],label:[.94,.95,.91,1],
    labelInk:[.07,.13,.16,1],screen:[.055,.12,.18,1],screenBlue:[.27,.69,.79,1],
    gloveBlue:[.26,.48,.71,1],glovePurple:[.49,.34,.65,1],gloveGreen:[.28,.57,.47,1],
    gloveBlack:[.19,.22,.27,1],glove:[.47,.66,.82,1],cartonEdge:[.46,.32,.20,1],
    signGreen:[.07,.36,.34,1],malletHead:[.16,.21,.23,1],grip:[.20,.23,.24,1]
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const n=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
  function dimensions(o) {
    const def=C.byType[o.type];
    return {w:n(o.w,def.w),d:n(o.d,def.d),h:n(o.h,def.h)};
  }
  function creformSpec(o) {
    const {w,d,h}=dimensions(o),p=o.params||{},ref=o.type==='creformCart';
    const diameter=ref?.028:clamp(n(p.pipeDiameter,.028),.016,.050);
    const jointDiameter=diameter*1.5,edge=diameter+jointDiameter;
    const levels=ref?2:Math.round(clamp(n(p.levels,3),1,6));
    const wheels=ref?4:(p.wheels===0?0:4),brakes=ref?2:Math.round(clamp(n(p.brakes,2),0,4));
    const first=Math.min(wheels?.22:.08,h*.23),last=Math.max(first,h-.23);
    const heights=ref?[h*.22/.95,h*.72/.95]:Array.from({length:levels},(_,i)=>levels===1?last:first+(last-first)*i/(levels-1));
    return {innerW:Math.max(.06,w-edge),innerD:Math.max(.06,d-edge),diameter,jointDiameter,levels,heights,wheels,brakes};
  }
  C.creformSpec=creformSpec;
  C.geometryDimensions=o=>newTypes.has(o.type)?dimensions(o):C.byType[o.type];
  C.geometryKey=o=>{
    if(typeof o==='string')return o;
    if(!newTypes.has(o.type))return o.type;
    const d=dimensions(o),p=o.params||{};
    return JSON.stringify([o.type,d.w,d.d,d.h,Object.keys(p).sort().map(k=>[k,p[k]])]);
  };
  // A tiny vector alphabet gives exported GLB the same labels as the offline UI.
  // Each contiguous row is a single quad, rather than a box or bitmap texture.
  const FONT={
    A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
    C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
    E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
    G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],
    I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','00010','10010','01100'],
    K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],
    M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],
    Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],
    S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
    U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
    W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],
    Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
    0:['01110','10001','10011','10101','11001','10001','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],
    2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],
    4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],
    6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],
    8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],
    '-':['00000','00000','00000','11111','00000','00000','00000'],'/':['00001','00001','00010','00100','01000','10000','10000'],
    '.':['00000','00000','00000','00000','00000','00110','00110'],':':['00000','00100','00100','00000','00100','00100','00000']
  };
  function build(type,object) {
    if(!newTypes.has(type))return oldGeometry(type,object);
    const def=C.byType[type],o={...def,...object,type},params={...(def.params||{}),...(o.params||{})};
    const {w,d,h}=dimensions(o),parts=new Map();
    const batch=m=>{if(!parts.has(m))parts.set(m,{mat:m,p:[],n:[],uv:[]});return parts.get(m);};
    const sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>{let l=Math.hypot(...a)||1;return a.map(v=>v/l);};
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    function tri(a,b,c,m,ns) {const q=batch(m),normal=norm(cross(sub(b,a),sub(c,a)));q.p.push(...a,...b,...c);q.n.push(...(ns?ns.flat():[...normal,...normal,...normal]));q.uv.push(0,0,1,0,1,1);}
    function quad(a,b,c,d,m) {tri(a,b,c,m);tri(a,c,d,m);}
    function box(x,y,z,bw,bh,bd,m) {
      const x0=x-bw/2,x1=x+bw/2,y0=y-bh/2,y1=y+bh/2,z0=z-bd/2,z1=z+bd/2;
      quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],m);quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],m);
      quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],m);quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],m);
      quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],m);quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],m);
    }
    function ring(x,y,z,bw,bd,r,taper=1) {
      r=Math.min(r,bw*.24,bd*.24);
      return [[-bw/2+r,-bd/2],[bw/2-r,-bd/2],[bw/2,-bd/2+r],[bw/2,bd/2-r],[bw/2-r,bd/2],[-bw/2+r,bd/2],[-bw/2,bd/2-r],[-bw/2,-bd/2+r]].map(([u,v])=>[x+u*taper,y,z+v*taper]);
    }
    function connect(a,b,m,inward=false) {for(let i=0;i<a.length;i++){let j=(i+1)%a.length;if(inward)quad(a[i],a[j],b[j],b[i],m);else quad(a[j],a[i],b[i],b[j],m);}}
    function bevel(x,y,z,bw,bh,bd,r,m,taper=1) {
      const a=ring(x,y-bh/2,z,bw,bd,r,taper),b=ring(x,y+bh/2,z,bw,bd,r);
      connect(a,b,m);for(let i=0;i<8;i++){let j=(i+1)%8;tri([x,y+bh/2,z],b[j],b[i],m);tri([x,y-bh/2,z],a[i],a[j],m);}
    }
    function rod(a,b,r,m,segments=10) {
      const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u);
      for(let i=0;i<segments;i++){
        const t=i*2*Math.PI/segments,t2=(i+1)*2*Math.PI/segments;
        const na=u.map((x,j)=>x*Math.cos(t)+v[j]*Math.sin(t)),nb=u.map((x,j)=>x*Math.cos(t2)+v[j]*Math.sin(t2));
        const pa=a.map((x,j)=>x+na[j]*r),pb=a.map((x,j)=>x+nb[j]*r),pc=b.map((x,j)=>x+nb[j]*r),pd=b.map((x,j)=>x+na[j]*r);
        tri(pa,pb,pc,m,[na,nb,nb]);tri(pa,pc,pd,m,[na,nb,na]);tri(a,pb,pa,m);tri(b,pd,pc,m);
      }
    }
    function path(points,r,m,segments=8) {for(let i=1;i<points.length;i++)rod(points[i-1],points[i],r,m,segments);}
    function lathe(x,z,profile,m,segments=24,aspect=1) {
      for(let j=1;j<profile.length;j++){
        const [y0,r0]=profile[j-1],[y1,r1]=profile[j],slope=-(r1-r0)/(y1-y0||.001);
        for(let i=0;i<segments;i++){
          const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
          const na=norm([Math.cos(a),slope,Math.sin(a)/aspect]),nb=norm([Math.cos(b),slope,Math.sin(b)/aspect]);
          const p=[x+r0*Math.cos(a),y0,z+r0*Math.sin(a)*aspect],q=[x+r0*Math.cos(b),y0,z+r0*Math.sin(b)*aspect];
          const r=[x+r1*Math.cos(b),y1,z+r1*Math.sin(b)*aspect],s=[x+r1*Math.cos(a),y1,z+r1*Math.sin(a)*aspect];
          tri(p,s,r,m,[na,na,nb]);tri(p,r,q,m,[na,nb,nb]);
        }
      }
    }
    function castor(x,z,r=.045,brake=false) {
      const width=r*.80;
      rod([x-width/2,r,z],[x+width/2,r,z],r,'rubber',16);
      rod([x-width*.53,r,z],[x+width*.53,r,z],r*.57,'steelChrome',12);
      rod([x-width*.56,r,z],[x+width*.56,r,z],r*.21,'graphite',8);
      for(let s of[-1,1])box(x+s*width*.64,r*1.36,z,.008,r*.98,r*.64,'steelZinc');
      box(x,r*1.91,z,width*1.5,.012,r*1.15,'steelZinc');rod([x,r*1.92,z],[x,r*2.6,z],r*.22,'steelChrome',10);
      box(x,r*2.55,z,r*1.32,.010,r*1.32,'steelZinc');
      if(brake){box(x,r*1.74,z+r*.86,width*1.1,.012,r*.65,'graphite');box(x,r*1.81,z+r*1.06,width,.009,r*.25,'steelChrome');}
    }
    function text(value,x,y,z,maxW,maxH,mat='labelInk') {
      const valueUpper=String(value||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/₂/g,'2').slice(0,64);
      const lines=valueUpper.split('\n').slice(0,4),max=Math.max(1,...lines.map(s=>s.length));
      const px=Math.min(maxW/(max*6-1),maxH/(lines.length*9-2)),height=(lines.length*9-2)*px;
      lines.forEach((line,lineIndex)=>{
        const left=x-(line.length*6-1)*px/2,top=y+height/2-lineIndex*9*px;
        [...line].forEach((char,index)=>{
          const glyph=FONT[char];if(!glyph)return;
          glyph.forEach((row,j)=>{for(let k=0;k<5;){if(row[k]!=='1'){k++;continue;}const start=k;while(row[k]==='1')k++;const x0=left+(index*6+start)*px,x1=left+(index*6+k)*px,y1=top-j*px,y0=y1-px;quad([x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],mat);}});
        });
      });
    }
    function label(value,x,y,z,lw,lh,m='label') {box(x,y,z,lw,lh,.002,m);text(value,x,y,z+.0012,lw*.86,lh*.75);}
    function creform() {
      const s=creformSpec(o),r=s.diameter/2,j=s.jointDiameter,px=(s.innerW+s.diameter)/2,pz=(s.innerD+s.diameter)/2;
      const wheelR=Math.min(.05,h*.065,w*.065,d*.105),bottom=s.wheels?wheelR*2.65:.014;
      function joint(x,y,z) {
        rod([x,y-j*.45,z],[x,y+j*.45,z],j/2,'graphite',10);
        // The tiny bright screw identifies an actual mechanical pipe coupling.
        rod([x,y,z+j*.47],[x,y,z+j*.53],j*.115,'steelChrome',6);
      }
      for(let x of[-px,px])for(let z of[-pz,pz]){
        if(s.wheels){
          // A real castor trails its swivel axis. Offset the wheel inwards so its
          // rolling envelope fits the declared outside dimensions of the cart.
          const cx=x-Math.sign(x)*wheelR*.30,cz=z-Math.sign(z)*wheelR;
          const index=(z>0?0:2)+(x>0?1:0);
          castor(cx,cz,wheelR,index<s.brakes);
          rod([cx,wheelR*2.55,cz],[x,bottom,z],r,'steelZinc',10);
        }
        rod([x,bottom,z],[x,h-r,z],r,'steelTube',12);
        joint(x,h-j*.5,z);
        if(!s.wheels)bevel(x,.009,z,j,.018,j,.004,'rubber');
      }
      for(const top of s.heights){
        const y=top-r;
        for(const z of[-pz,pz])rod([-px,y,z],[px,y,z],r,'steelTube',12);
        for(const x of[-px,px])rod([x,y,-pz],[x,y,pz],r,'steelTube',12);
        // Two actual bearing rails support boxes, without filling the open cart.
        for(const x of[-s.innerW*.27,s.innerW*.27])rod([x,y,-pz],[x,y,pz],r,'steelTube',12);
        for(const x of[-px,px])for(const z of[-pz,pz])joint(x,y,z);
        const guard=Math.min(top+.052,h-j*.6);
        for(const z of[-pz,pz])rod([-px,guard,z],[px,guard,z],r,'steelTube',12);
        for(const x of[-px,px])for(const z of[-pz,pz])joint(x,guard,z);
      }
      const top=h-r;
      for(const z of[-pz,pz])rod([-px,top,z],[px,top,z],r,'steelTube',12);
      for(const x of[-px,px])rod([x,top,-pz],[x,top,pz],r,'steelTube',12);
      // No rear diagonal, fixed bins, trays or additional accessories.
    }

    function creformVariant(cfg) {
      const pipeD=cfg.pipeDiameter||.028,jointD=cfg.jointDiameter||pipeD*1.5,r=pipeD/2,jr=jointD/2;
      const innerW=cfg.innerW||Math.max(.06,w-(pipeD+jointD)),innerD=cfg.innerD||Math.max(.06,d-(pipeD+jointD));
      const px=(innerW+pipeD)/2,pz=(innerD+pipeD)/2;
      const wheelR=cfg.wheels===false?0:Math.min(cfg.wheelRadius||.046,h*.07,w*.075,d*.13),baseY=cfg.wheels===false?.014:wheelR*2.65;
      const pipeMat=cfg.pipeMat||'creformBlue',jointMat=cfg.jointMat||'graphite';
      function joint(x,y,z){
        rod([x,y-jr*.45,z],[x,y+jr*.45,z],jr,jointMat,10);
        rod([x,y,z+jr*.47],[x,y,z+jr*.53],jr*.12,'steelChrome',6);
      }
      function perimeter(y){
        for(const z of[-pz,pz])rod([-px,y,z],[px,y,z],r,pipeMat,12);
        for(const x of[-px,px])rod([x,y,-pz],[x,y,pz],r,pipeMat,12);
        for(const x of[-px,px])for(const z of[-pz,pz])joint(x,y,z);
      }
      function shelf(y,opts={}){
        perimeter(y);
        const zInset=Math.max(r*1.4,.030),xInset=Math.max(r*1.4,.035);
        const zCount=Math.max(5,Math.round(innerD/.045));
        for(let i=0;i<zCount;i++){
          const t=zCount===1?0:i/(zCount-1),zz=-innerD/2+zInset+t*(innerD-2*zInset);
          rod([-innerW/2+xInset,y,zz],[innerW/2-xInset,y,zz],r*.92,pipeMat,12);
        }
        if(opts.centerSupport){
          rod([0,baseY+.010,0],[0,y-r*.1,0],r*.88,pipeMat,12);
          joint(0,baseY+.010,0);
        }
        const stop=opts.stopHeight||.050;
        if(opts.lowStop){
          const sy=Math.min(h-r*.2,y+stop);
          for(const z of[-pz,pz])rod([-px,sy,z],[px,sy,z],r,pipeMat,12);
          for(const x of[-px,px])rod([x,sy,-pz],[x,sy,pz],r,pipeMat,12);
          if(opts.frontGap){
            const gap=Math.min(innerW*.18,Math.max(.10,opts.frontGap));
            rod([-px,sy,pz],[-gap/2,sy,pz],r,pipeMat,12);
            rod([gap/2,sy,pz],[px,sy,pz],r,pipeMat,12);
          }
          for(const x of[-px,px])for(const z of[-pz,pz])joint(x,sy,z);
        }
      }
      for(const x of[-px,px])for(const z of[-pz,pz]){
        if(cfg.wheels!==false){
          const cx=x-Math.sign(x)*wheelR*.30,cz=z-Math.sign(z)*wheelR;
          const brakes=cfg.brakes||0,index=(z>0?0:2)+(x>0?1:0);
          castor(cx,cz,wheelR,index<brakes);
          rod([cx,wheelR*2.55,cz],[x,baseY,z],r,'steelZinc',10);
        } else bevel(x,.009,z,jointD,.018,jointD,.004,'rubber');
        rod([x,baseY,z],[x,h-r,z],r,pipeMat,12);
        joint(x,h-jr*.5,z);
      }
      perimeter(baseY);
      if(cfg.crossBase){
        rod([-px,baseY,0],[px,baseY,0],r,pipeMat,12);
        rod([0,baseY,-pz],[0,baseY,pz],r,pipeMat,12);
      }
      for(const s of(cfg.shelves||[])) shelf(s.y,s);
      if(cfg.openTop!==false) perimeter(h-r);
    }

    function plasticBox() {
      const thickness=Math.min(.007,w*.03,d*.03),rr=Math.min(.018,w*.07,d*.07),bodyW=w-.009,bodyD=d-.009;
      const outer0=ring(0,thickness,0,bodyW,bodyD,rr,.94),outer1=ring(0,h-.012,0,bodyW,bodyD,rr);
      const inner0=ring(0,thickness,0,bodyW-thickness*2,bodyD-thickness*2,Math.max(.002,rr-thickness),.94),inner1=ring(0,h-.012,0,bodyW-thickness*2,bodyD-thickness*2,Math.max(.002,rr-thickness));
      connect(outer0,outer1,'plastic');connect(inner0,inner1,'plastic',true);
      bevel(0,thickness/2,0,bodyW*.94,thickness,bodyD*.94,rr,'plasticRim');
      const rim0=ring(0,h-.014,0,w,d,rr),rim1=ring(0,h,0,w,d,rr),rimInner=ring(0,h,0,bodyW-thickness*2,bodyD-thickness*2,Math.max(.002,rr-thickness));
      connect(rim0,rim1,'plasticRim');
      for(let i=0;i<8;i++){let j=(i+1)%8;quad(rim1[i],rim1[j],rimInner[j],rimInner[i],'plasticRim');}
      // Reinforcing corners and moulded grip plates stop the plastic reading as glass.
      for(let x of[-1,1])for(let z of[-1,1])rod([x*(bodyW*.47-rr*.4),.012,z*(bodyD*.47-rr*.4)],[x*(bodyW/2-rr*.4),h-.018,z*(bodyD/2-rr*.4)],.003,'plasticRim',6);
      for(let z of[-1,1]){box(0,h-.021,z*(d/2-.003),w*.30,.025,.006,'plasticRim');box(0,h-.024,z*(d/2+.0002),w*.20,.007,.001,'steelLight');}
    }
    if(type==='creformCart'||type==='creformBuilder')creform();
    if(type==='creformIptCart')creformVariant({innerW:.75,innerD:.45,pipeMat:'creformBlue',shelves:[{y:.34,lowStop:true,stopHeight:.042,centerSupport:true},{y:.93,lowStop:true,stopHeight:.050}],brakes:2,openTop:true});
    if(type==='creformTallRack')creformVariant({innerW:.90,innerD:.60,pipeMat:'creformBlue',shelves:[{y:.60},{y:1.20}],brakes:0,openTop:true});
    if(type==='creformLowRack')creformVariant({innerW:.80,innerD:.40,pipeMat:'creformBlue',shelves:[{y:.10},{y:.55},{y:.995}],brakes:0,openTop:false});
    if(type==='plasticBoxSmall'||type==='plasticBoxLarge')plasticBox();
    if(type==='largeWheelBin'){
      const r=Math.min(.065,w*.09,d*.09,h*.08);
      for(const x of[-w*.34,w*.34])for(const z of[-d*.31,d*.31])castor(x,z,r,z>0);
      bevel(0,h*.52,0,w*.91,h*.72,d*.88,.038,'graphite',.79);
      for(let x of[-w*.28,0,w*.28])box(x,h*.40,d*.40,.025,h*.42,.012,'graphite');
      bevel(0,h*.905,0,w,h*.045,d,.035,'rubber');
      bevel(0,h*.947,0,w*.98,h*.041,d*.97,.035,'graphite');
      bevel(0,h*.971,0,w*.78,h*.018,d*.76,.030,'graphite');
      for(let x of[-w*.34,w*.34])rod([x,h*.89,-d*.44],[x,h*.96,-d*.44],.018,'rubber');
      rod([-w*.29,h*.982,-d*.44],[w*.29,h*.982,-d*.44],.018,'graphite');
      for(let x of[-1,1])path([[x*w*.45,h*.79,-d*.16],[x*w*.48,h*.79,-d*.16],[x*w*.48,h*.79,d*.12],[x*w*.45,h*.79,d*.12]],.014,'graphite',8);
      label('WASTE',0,h*.68,d*.444,w*.27,h*.11);
    }
    if(type==='palletTruck'){
      const forkW=w*.24,forkH=Math.min(.065,h*.06),front=-d*.46,rear=d*.33;
      for(let x of[-w*.34,w*.34]){
        bevel(x,.085,(front+rear)/2,forkW,forkH,rear-front,.024,'truckYellow',.97);
        bevel(x,.073,front+.025,forkW*.91,forkH*.65,.08,.020,'truckYellow');
        for(let z of[front+.10,front+.17])rod([x-forkW*.39,.034,z],[x+forkW*.39,.034,z],.034,'rubber',12);
      }
      bevel(0,.14,d*.27,w,.15,d*.17,.022,'truckYellow');
      rod([0,.15,d*.32],[0,.36,d*.32],.055,'steelChrome',16);
      for(let x of[-.075,.075])rod([x-.03,.075,d*.36],[x+.03,.075,d*.36],.075,'rubber',16);
      const base=[0,.29,d*.32],top=[0,h*.85,d*.42],handleW=w*.32;
      rod(base,top,.023,'graphite',12);
      path([[-handleW,h*.83,d*.42],[-handleW,h*.96,d*.42],[-handleW*.65,h-.017,d*.42],[handleW*.65,h-.017,d*.42],[handleW,h*.96,d*.42],[handleW,h*.83,d*.42],[-handleW,h*.83,d*.42]],.016,'graphite',10);
      rod([-.055,h*.88,d*.426],[.055,h*.88,d*.426],.009,'steelChrome',8);
      label('2500',0,.19,d*.358,w*.34,.055);
    }
    if(type==='cageCart'){
      const r=Math.min(.055,h*.06,d*.09),y0=r*2.7,px=w/2-.016,pz=d/2-.016,top=h-.014;
      for(let x of[-px+.035,px-.035])for(let z of[-pz+.065,pz-.065])castor(x,z,r,z>0);
      bevel(0,y0,0,w-.012,.035,d-.012,.015,'orange');
      for(let x of[-px,px])for(let z of[-pz,pz])rod([x,y0,z],[x,top,z],.013,'steelZinc',10);
      for(let z of[-pz,pz]){
        rod([-px,top,z],[px,top,z],.012,'steelChrome',10);
        for(let x=-px+.07;x<px-.03;x+=.105)rod([x,y0+.02,z],[x,top,z],.0038,'steelZinc',6);
        for(let y=y0+.12;y<top-.03;y+=.15)rod([-px,y,z],[px,y,z],.0038,'steelZinc',6);
      }
      for(let x of[-px,px]){
        rod([x,top,-pz],[x,top,pz],.012,'steelChrome',10);
        for(let z=-pz+.07;z<pz-.03;z+=.105)rod([x,y0+.02,z],[x,top,z],.0038,'steelZinc',6);
        for(let y=y0+.12;y<top-.03;y+=.15)rod([x,y,-pz],[x,y,pz],.0038,'steelZinc',6);
      }
      label('LAUNDRY',0,y0+.22,pz+.004,w*.34,.085);
    }
    if(type==='dryIceDrum'){
      const r=Math.min(w,d)*.46,aspect=d/w,wheel=Math.min(.045,h*.06),bottom=wheel*2.65;
      for(let x of[-w*.28,w*.28])for(let z of[-d*.28,d*.28])castor(x,z,wheel,z>0);
      lathe(0,0,[[bottom,0],[bottom,r*.91],[bottom+.025,r],[h*.82,r],[h*.85,r*.98]],'steelBrushed',28,aspect);
      lathe(0,0,[[h*.85,r*.98],[h*.87,r],[h*.90,r]],'steelChrome',28,aspect);
      // Interrupted upper cover and a lifted centre intentionally show openings.
      rod([0,h*.91,0],[0,h*.927,0],r*.86,'steelZinc',28);
      for(let a=0;a<4;a++){let t=a*Math.PI/2;box(Math.cos(t)*r*.80,h*.895,Math.sin(t)*r*.80,.018,.035,.018,'graphite');}
      path([[-w*.12,h*.932,0],[-w*.12,h*.98,0],[w*.12,h*.98,0],[w*.12,h*.932,0]],.009,'graphite',8);
      for(let side of[-1,1])path([[side*r*.92,h*.68,-d*.10],[side*w*.48,h*.68,-d*.10],[side*w*.48,h*.68,d*.10],[side*r*.92,h*.68,d*.10]],.009,'steelChrome');
      label('TORR-IS',0,h*.60,r*aspect+.002,w*.42,h*.11);
    }
    if(type==='nitrogenTank'){
      const rad=Math.min(w,d)*.34,aspect=d/w,bottom=.022;
      lathe(0,0,[[bottom,0],[bottom,rad*.84],[.05,rad],[h*.76,rad],[h*.80,rad*.98],[h*.84,rad*.85],[h*.87,rad*.57],[h*.885,rad*.28]],'gasGrey',28,aspect);
      lathe(0,0,[[h*.81,rad*.97],[h*.84,rad*.85],[h*.87,rad*.57],[h*.885,rad*.28]],'gasGreen',28,aspect);
      rod([0,h*.882,0],[0,h*.932,0],rad*.20,'brass',12);
      rod([0,h*.911,0],[rad*.42,h*.911,0],rad*.14,'brass',10);
      rod([0,h*.938,0],[0,h*.948,0],rad*.34,'graphite',12);
      for(let x of[-rad*.45,rad*.45])rod([x,h*.88,-rad*.26],[x,h*.986,-rad*.26],.010,'steelZinc',8);
      rod([-rad*.45,h*.986,-rad*.26],[rad*.45,h*.986,-rad*.26],.010,'steelZinc',8);
      label('N2\nNITROGEN',0,h*.67,rad*aspect+.001,w*.45,h*.12);
      if(params.stand!==false){
        bevel(0,.013,0,w,.026,d,.012,'steelBrushed');
        for(let x of[-w*.45,w*.45])rod([x,.026,-d*.35],[x,h*.46,-d*.35],.014,'steelBrushed',8);
        rod([-w*.45,h*.44,-d*.35],[w*.45,h*.44,-d*.35],.014,'steelBrushed',8);
        // Open front retaining rail makes the optional stand recognisable.
        path([[-w*.45,h*.42,-d*.35],[-w*.45,h*.42,d*.26],[w*.45,h*.42,d*.26],[w*.45,h*.42,-d*.35]],.008,'steelZinc',8);
      }
    }
    if(type==='extinguisher'){
      const rad=Math.min(w*.36,d*.40),aspect=1,bh=h*.77;
      lathe(-w*.05,0,[[0,0],[0,rad*.82],[h*.035,rad],[bh*.84,rad],[bh*.94,rad*.84],[bh,rad*.36]],'red',24,aspect);
      rod([-w*.05,bh,0],[-w*.05,h*.89,0],rad*.21,'brass',10);
      box(-w*.03,h*.90,0,w*.54,.018,.035,'graphite');
      path([[-w*.28,h*.90,0],[-w*.20,h*.98,0],[w*.14,h*.98,0],[w*.20,h*.92,0]],.009,'graphite',8);
      path([[w*.06,h*.86,0],[w*.34,h*.83,.014],[w*.44,h*.62,.026],[w*.40,h*.31,.04],[w*.30,h*.24,.047]],.010,'rubber',8);
      rod([w*.30,h*.24,.047],[w*.26,h*.16,.049],.016,'graphite',10);
      label('ABC\nFIRE',-w*.05,h*.48,rad+.001,w*.48,h*.28);
      rod([-w*.05,h*.86,.020],[-w*.05,h*.86,.033],.018,'steelChrome',14);
      rod([-w*.05,h*.86,.034],[-w*.05,h*.86,.035],.014,'label',14);
    }
    if(type==='extinguisherBracket'){
      bevel(0,h/2,-d*.42,w*.36,h,d*.16,.006,'graphite');
      box(0,.014,0,w,.028,d,'graphite');
      for(let y of[h*.18,h*.83])rod([0,y,-d*.32],[0,y,-d*.31],.008,'steelChrome',8);
      path([[-w*.42,h*.58,-d*.37],[-w*.44,h*.58,d*.37],[w*.44,h*.58,d*.37],[w*.42,h*.58,-d*.37]],.009,'graphite',8);
    }
    if(type==='phoneArm'){
      const angle=clamp(n(params.direction,0),-65,65)*Math.PI/180;
      const back=-d/2,plateY=h*.45,phoneW=Math.min(.085,w*.37),phoneH=Math.min(.17,h*.63);
      const lateralReach=(w/2-phoneW/2-.010)/Math.max(.001,Math.abs(Math.sin(angle))*.75);
      const reach=Math.min(clamp(n(params.reach,.25),.08,Math.max(.08,d-.045)),Math.max(.035,lateralReach));
      bevel(0,plateY,back+.006,w*.27,h*.48,.012,.008,'steelBrushed');
      for(let x of[-w*.09,w*.09])for(let y of[plateY-h*.16,plateY+h*.16])rod([x,y,back+.012],[x,y,back+.014],.004,'graphite',8);
      const elbow=[Math.sin(angle)*reach*.42,plateY,back+reach*.51],end=[Math.sin(angle)*reach*.75,plateY+.025,back+reach];
      rod([0,plateY,back+.014],elbow,.013,'steelBrushed',12);rod(elbow,end,.012,'steelBrushed',12);
      for(const p of[[0,plateY,back+.028],elbow,end])rod([p[0],p[1]-.018,p[2]],[p[0],p[1]+.018,p[2]],.020,'graphite',12);
      const [x,y,z]=end,py=clamp(y+phoneH*.05,phoneH/2,h-phoneH/2);
      bevel(x,py,z+.015,phoneW+.013,phoneH*.62,.023,.005,'graphite');
      bevel(x,py,z+.032,phoneW,phoneH,.012,.008,'graphite');
      bevel(x,py,z+.0386,phoneW*.90,phoneH*.91,.001,.006,'screen');
      box(x,py+phoneH*.41,z+.04,phoneW*.26,.003,.001,'graphite');
      text('4',x,py+phoneH*.17,z+.040,phoneW*.22,phoneH*.19,'screenBlue');
      text('SAMPLE\nPOINTS',x,py-phoneH*.09,z+.040,phoneW*.76,phoneH*.23,'label');
      box(x,py-phoneH*.35,z+.04,phoneW*.45,.005,.001,'screenBlue');
    }
    if(type==='gloveHolder'){
      const color={blue:'gloveBlue',purple:'glovePurple',green:'gloveGreen',black:'gloveBlack'}[params.color]||'gloveBlue';
      box(0,h*.48,-d*.45,w,h*.95,d*.08,'steelZinc');
      bevel(0,h*.52,0,w*.91,h*.86,d*.82,.006,color);
      box(0,h*.15,d*.40,w*.91,h*.25,.002,'label');
      text('NITRILE',0,h*.15,d*.403,w*.64,h*.16);
      // Dark oval opening with a blue glove emerging through its centre.
      const cx=0,cy=h*.61,cz=d*.414,rx=w*.26,ry=h*.19;
      for(let i=0;i<20;i++){let a=i*Math.PI/10,b=(i+1)*Math.PI/10;tri([cx,cy,cz],[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,cz],[cx+Math.cos(b)*rx,cy+Math.sin(b)*ry,cz],'graphite');}
      for(let k=0;k<4;k++)box((k-1.5)*w*.036,h*(.57+k*.012),d*.435,w*.028,h*(.17-k*.012),.007,'glove');
      bevel(w*.045,h*.55,d*.434,w*.10,h*.12,.009,.006,'glove');
      for(let x of[-w*.46,w*.46])path([[x,.008,-d*.46],[x,.008,d*.48],[x,h*.40,d*.48]],.007,'steelChrome',8);
      rod([-w*.46,h*.30,d*.48],[w*.46,h*.30,d*.48],.006,'steelChrome',8);
    }
    if(type==='sampleBag'){
      const source=root.CartridgeMesh;
      if(!source||!Array.isArray(source.parts))throw Error('Privat cartridge-mesh.js saknas. Påsen kan inte skapas utan modellen.');
      const scale=Math.min(w/.24,d/.12,h/.09),sourceCentreZ=(source.bounds.min[2]+source.bounds.max[2])/2;
      for(let row=0;row<2;row++)for(let col=0;col<5;col++){
        const tx=(col-2)*.046*scale,tz=(row-.5)*.054*scale-sourceCentreZ*scale,ty=.007*scale;
        for(const part of source.parts){
          if(!C.MATS[part.mat])C.MATS[part.mat]=part.color;
          const out=batch(part.mat);
          for(let i=0;i<part.p.length;i+=3)out.p.push(part.p[i]*scale+tx,part.p[i+1]*scale+ty,part.p[i+2]*scale+tz);
          for(let i=0;i<part.n.length;i++)out.n.push(part.n[i]);
          for(let i=0;i<part.uv.length;i++)out.uv.push(part.uv[i]);
        }
      }
      const profiles=[[.002,.93],[h*.15,1],[h*.75,.99],[h*.87,.93],[h,.95]];
      const rings=profiles.map(([y,s])=>ring(0,y,0,w*s,d*s,.012));
      for(let i=1;i<rings.length;i++)connect(rings[i-1],rings[i],'bagFilm');
      for(let i=0;i<8;i++){const j=(i+1)%8;tri([0,.002,0],rings[0][i],rings[0][j],'bagFilm');}
      connect(ring(0,h*.94,0,w*.956,d*.956,.012),ring(0,h,0,w*.956,d*.956,.012),'bagFold');
      for(let side of[-1,1])for(let x of[-w*.34,0,w*.34])quad([x,.006,side*d*.477],[x+.007,h*.49,side*d*.495],[x+.011,h*.84,side*d*.465],[x+.004,h*.33,side*d*.495],'bagFold');
    }
    if(type==='carton'){
      const t=Math.min(.004,w*.02,d*.02),open=!!params.open,bodyH=open?h*.77:h;
      if(!open)bevel(0,bodyH/2,0,w,bodyH,d,.006,'cardboard');
      else{
        box(0,t/2,0,w,t,d,'cardboard');
        for(let x of[-1,1])box(x*(w-t)/2,bodyH/2,0,t,bodyH,d,'cardboard');
        for(let z of[-1,1])box(0,bodyH/2,z*(d-t)/2,w,bodyH,t,'cardboardLight');
        // Four inward-leaning flaps fit the declared footprint and total height.
        for(let side of[-1,1]){
          const x=side*w/2,ix=side*w*.24,top=h;
          quad([x,bodyH,-d/2],[x,bodyH,d/2],[ix,top,d/2],[ix,top,-d/2],'cardboardLight');
          quad([ix,top,-d/2],[ix,top,d/2],[x,bodyH,d/2],[x,bodyH,-d/2],'cardboard');
          const z=side*d/2,iz=side*d*.26;
          quad([-w/2,bodyH,z],[w/2,bodyH,z],[w/2,h*.94,iz],[-w/2,h*.94,iz],'cardboard');
          quad([-w/2,h*.94,iz],[w/2,h*.94,iz],[w/2,bodyH,z],[-w/2,bodyH,z],'cardboardLight');
        }
      }
      if(!open){box(0,h+.0008,0,Math.min(.055,w*.16),.0016,d,'tape');box(0,h*.48,d/2+.0008,Math.min(.055,w*.16),h*.96,.0016,'tape');box(0,h+.001,0,w*.96,.001,.0015,'cartonEdge');}
      for(let x of[-w*.49,w*.49])box(x,bodyH*.5,d/2+.0008,.0014,bodyH*.94,.0016,'cartonEdge');
      label('MATERIAL',-w*.18,bodyH*.60,d/2+.002,w*.28,bodyH*.23);
      for(let k=0;k<8;k++)box(w*.22+(k-3.5)*w*.009,bodyH*.29,d/2+.003,w*(k%3?.004:.008),bodyH*.16,.001,'labelInk');
    }
    if(type==='knife'){
      bevel(-w*.08,h*.50,0,w*.82,h*.85,d,.008,'orange');
      bevel(-w*.15,h*.51,0,w*.48,h*.90,d*.92,.007,'grip');
      for(let k=0;k<6;k++)box(-w*.30+k*w*.065,h*.94,0,.003,.002,d*.62,'graphite');
      box(w*.08,h*.93,0,w*.17,h*.12,d*.47,'graphite');
      quad([w*.32,h*.58,-d*.32],[w*.50,h*.58,-d*.23],[w*.46,h*.58,d*.23],[w*.32,h*.58,d*.32],'steelChrome');
      quad([w*.32,h*.57,d*.32],[w*.46,h*.57,d*.23],[w*.50,h*.57,-d*.23],[w*.32,h*.57,-d*.32],'steelBrushed');
    }
    if(type==='mallet'){
      rod([-w*.49,h*.46,0],[w*.24,h*.46,0],Math.min(h*.22,d*.16),'woodLight',12);
      rod([-w*.47,h*.46,0],[-w*.04,h*.46,0],Math.min(h*.26,d*.20),'grip',12);
      for(let x=-w*.44;x<-w*.06;x+=w*.05)rod([x,h*.46,0],[x+w*.008,h*.46,0],Math.min(h*.275,d*.21),'graphite',10);
      rod([w*.27,h*.50,-d*.48],[w*.27,h*.50,d*.48],h*.48,'malletHead',16);
      rod([w*.27,h*.50,-d*.50],[w*.27,h*.50,-d*.40],h*.49,'steelLight',16);
      rod([w*.27,h*.50,d*.40],[w*.27,h*.50,d*.50],h*.49,'steelLight',16);
      box(w*.27,h*.50,0,w*.18,h*.57,d*.24,'steelBrushed');
    }
    if(type==='sign'){
      bevel(0,h/2,0,w,h,d,.009,'signGreen');
      const value=String(params.text||o.label||'IPT SAMPLE POINTS').slice(0,64);
      const words=value.split(/\s+/),lines=[];let line='';
      const maxChars=Math.max(9,Math.round(w/h*5.5));
      for(const word of words){if(line&&(line+' '+word).length>maxChars){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
      text(lines.slice(0,3).join('\n'),0,h/2,d/2+.0008,w*.88,h*.70,'label');
      for(let x of[-w*.46,w*.46])for(let y of[h*.12,h*.88])rod([x,y,d/2],[x,y,d/2+.001],Math.min(.003,w*.012),'steelChrome',8);
    }
    const result=[...parts.values()].map(part=>({...part,p:new Float32Array(part.p),n:new Float32Array(part.n),uv:new Float32Array(part.uv)}));
    if(type==='sampleBag')result.cartridgeCount=10;
    return result;
  }
  C.buildGeometry=build;
  C.V4_OBJECT_TYPES=Object.freeze([...newTypes]);
  if(typeof module==='object'&&module.exports)module.exports=C;
})(typeof globalThis!=='undefined'?globalThis:this);
