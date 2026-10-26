/* Rebuild three explicit V5 scenario files; ordinary V4 examples remain importable. */
const fs=require('node:fs'),path=require('node:path');
const p=path.resolve(__dirname,'..'),C=require('./planner-core.js');
require('./cartridge-mesh.js');require('./object-library.js');require('./studio-core.js');
const S=require('./simulation-core.js'),E=require('./elevator.js'),info=require('./model_manifest.json');
const read=name=>JSON.parse(fs.readFileSync(path.join(p,'examples',name),'utf8'));
function write(name,layout,specs,{chaos=false}={}){
 layout.door={angle:90,direction:1};layout.name=name.replaceAll('_',' ').replace('.json','');
 const sim=S.create({info,getLayout:()=>layout,getDoor:()=>layout.door,getElevator:()=>E,seed:5412});
 for(const spec of specs){if(!sim.add(spec))throw Error('Example placement failed: '+JSON.stringify(spec));}
 sim.setChaos(chaos);const scenario={format:'hissrum12-v5-scenario',version:1,layout,simulation:sim.exportConfig(),elevator:{version:1,floor:3,lights:true,sound:false},display:{quality:'auto'}};
 const checked=S.create({info,getLayout:()=>C.validate(layout,info),getDoor:()=>layout.door,getElevator:()=>E});checked.importConfig(scenario.simulation);
 fs.writeFileSync(path.join(p,'examples',name),JSON.stringify(scenario,null,2)+'\n');console.log(name+': '+specs.length+' personer, '+layout.objects.length+' möbler');return scenario;
}
const people=[{name:'Kollega · lång frisyr',appearance:'colleague-a',height:1.68,x:-1.7,z:-1.5},{name:'Kollega · vardagskläder',appearance:'colleague-b',height:1.78,x:-.5,z:.3},{name:'Kollega · labbrock',appearance:'colleague-c',height:1.6,x:1.5,z:.2},{name:'Kollega · arbetskläder',appearance:'material-handler',height:1.75,x:1.8,z:1.4}];
write('V5_01_Liv_i_5S_rummet.json',read('V4_04_Kombinerat_5S.json'),people);
const mhLayout=read('V4_02_IPT.json'),target=mhLayout.objects.find(o=>o.type==='creformCart');
write('V5_02_MH_upphamtning.json',mhLayout,[{name:'Material Handler',mode:'handler',appearance:'material-handler',height:1.75,destination:{objectId:target.id}}]);
const chaosLayout=read('V4_04_Kombinerat_5S.json');chaosLayout.zones.push({name:'Tillfällig simulationsyta',a:[-1.5,.03,.7],b:[-.5,.03,1.7]});
write('V5_03_Kaizen_Chaos.json',chaosLayout,people,{chaos:true});
