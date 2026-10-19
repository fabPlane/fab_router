/** Retain all nine direct-pour controls: component anchoring cannot invent contacts. */
import {existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {emptyLayout,makeSpacingTable} from '../../../../src/layout/index.ts';
import type {Pt} from '../../../../spec/types/layout.ts';
function fixture(name:string){
 const l=emptyLayout(`pour-${name}`);
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[{id:0,name:'front',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'round',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:300}]]])}];
 const box=(x0:number,y0:number,x1:number,y1:number):Pt[]=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
 let at={x:-5000,y:0},outline=box(0,-4000,8000,4000),holes:Pt[][]=[];
 if(name==='hole'){at={x:0,y:0};outline=box(-6000,-6000,6000,6000);holes=[box(-3000,-3000,3000,3000)];}
 if(name==='concave'){at={x:6000,y:6000};outline=[{x:0,y:0},{x:10000,y:0},{x:10000,y:2000},{x:2000,y:2000},{x:2000,y:10000},{x:0,y:10000}];}
 l.pads=[{id:0,part:0,pinName:'0',net:0,form:0,at,rotationDeg:0,side:'front',sheets:[0],kind:1,hold:'locked'}];
 l.pours=[{id:1,net:0,sheet:0,outline,holes,kind:1,hold:'locked',origin:'file'}];
 if(name==='disjoint-sheet'){
  l.stack=[...l.stack,{id:1,name:'back',role:'signal',active:true,preferDir:null}];
  l.pours=l.pours.map(p=>({...p,sheet:1}));
 }
 if(name==='nearest-blocked')l.fences=[{id:2,sheet:0,scope:'track',shape:{kind:'disk',c:{x:0,y:0},r:800},kind:1}];
 if(name==='blocked')l.fences=[{id:2,sheet:0,scope:'track',shape:{kind:'disk',c:{x:4000,y:0},r:6000},kind:1}];
 if(name==='keepout')l.fences=[{id:2,sheet:0,scope:'track',shape:{kind:'disk',c:{x:0,y:-4000},r:800},kind:1}];
 l.nets=[{id:0,name:'target',group:0,pads:[0]}];
 l.netGroups=[{id:0,name:'default',nets:[0],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1}}];
 if(name==='reverse'){
  l.pads=l.pads.map(p=>({...p,id:1}));l.pours=l.pours.map(p=>({...p,id:0}));l.nets=l.nets.map(n=>({...n,pads:[1]}));
 }
 if(name==='foreign'){
  l.pads=[...l.pads,{...l.pads[0]!,id:2,net:1,at:{x:-2500,y:0}}];
  l.nets=[...l.nets,{id:1,name:'obstacle',group:0,pads:[2]}];l.netGroups=l.netGroups.map(g=>({...g,nets:[0,1]}));
 }
 return l;
}
const [before,after,out]=process.argv.slice(2);if(!before||!after||!out||existsSync(out))throw Error('Expected BEFORE AFTER UNUSED_OUTPUT');
const rows=[];
for(const [mode,root]of [['before',before],['after',after]]){
 const load=(p:string)=>import(pathToFileURL(resolve(root!,p)).href);
 const {recoverRemaining}=await load('src/route/recover-remaining.ts');
 const {resolveSettings}=await load('src/pipeline/index.ts');
 const {checkDrc,requiredConnections,writeSes}=await load('src/api.ts');
 for(const name of ['solid','hole','concave','keepout','nearest-blocked','disjoint-sheet','blocked','reverse','foreign']){
  const sessions=[];
  for(let repeat=1;repeat<=3;repeat++){
   const l=fixture(name),saved=JSON.stringify([l.pads,l.pours,l.fences]),ses=writeSes(l);
   if(requiredConnections(l).length!==1||checkDrc(l).counts.violations)throw Error('Baseline');
   const start=performance.now(),result=recoverRemaining(l,resolveSettings({},undefined,l.angleMode),true),seconds=(performance.now()-start)/1000;
   if(requiredConnections(l).length!==1||checkDrc(l).counts.violations||writeSes(l)!==ses||JSON.stringify([l.pads,l.pours,l.fences])!==saved||result.targets[0]?.status!=='unsupported-endpoints')throw Error('False contact/preservation');
   rows.push({mode,name,repeat,seconds,incomplete:1,exact:0,result,ses});sessions.push(ses);
  }
  if(new Set(sessions).size!==1)throw Error('Nondeterministic');
 }
}
for(const r of rows.filter(r=>r.mode==='after'))if(r.ses!==rows.find(x=>x.mode==='before'&&x.name===r.name&&x.repeat===r.repeat)!.ses)throw Error('Changed session');
writeFileSync(out,JSON.stringify({scope:'Nine synthetic direct-pour controls, three repeats/source, no native score; all must remain open without an existing component point',rows},null,2)+'\n');
