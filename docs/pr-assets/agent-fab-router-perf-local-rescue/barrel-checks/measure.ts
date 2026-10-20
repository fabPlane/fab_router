/** Three fresh recovery trials per source on an otherwise identical barrel stall. */
import {writeFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {emptyLayout,makeSpacingTable} from '../../../../src/layout/index.ts';
function fixture(){
 const l=emptyLayout('barrel-stall');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[0,1,2].map(id=>({id,name:`sheet-${id}`,role:'signal' as const,active:true,preferDir:null}));
 l.padForms=[{id:0,name:'round',attachAllowed:true,perSheet:new Map([0,1,2].map(id=>[id,[{kind:'disk' as const,c:{x:0,y:0},r:300}]])),drill:{diameter:200,fromSheet:0,toSheet:2}}];
 l.pads=[{id:0,part:0,pinName:'0',net:0,form:0,at:{x:0,y:0},rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const}];
 l.barrels=[{id:1,net:0,at:{x:10000,y:0},form:0,fromSheet:0,toSheet:1,kind:1,hold:'locked' as const,origin:'file' as const}];
 l.pads=[...l.pads,{...l.pads[0]!,id:2,pinName:'2',at:{x:12000,y:0},sheets:[1]}];
 l.tracks=[{id:3,net:0,sheet:1,pts:[{x:10000,y:0},{x:12000,y:0}],width:200,kind:1,hold:'locked',origin:'file'}];
 l.nets=[{id:0,name:'target',group:0,pads:[0,2]}];
 l.netGroups=[{id:0,name:'default',nets:[0],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1}}];
 return l;
}

const [before,after,out]=process.argv.slice(2);
if(!before||!after||!out||existsSync(out))throw Error('Expected BEFORE_ROOT AFTER_ROOT UNUSED_OUTPUT');
const rows=[];
for(const [mode,root] of [['before',before],['after',after]] as const){
 const load=(file:string)=>import(pathToFileURL(resolve(root,file)).href);
 const {recoverRemaining}=await load('src/route/recover-remaining.ts');
 const {resolveSettings}=await load('src/pipeline/index.ts');
 const {checkDrc,requiredConnections,writeSes}=await load('src/api.ts');
 for(let repeat=1;repeat<=3;repeat++){
  const layout=fixture(),retained=JSON.stringify({pads:layout.pads,tracks:layout.tracks,barrels:layout.barrels});
  const settings=resolveSettings({},undefined,layout.angleMode),start=performance.now();
  const result=recoverRemaining(layout,settings,true),seconds=(performance.now()-start)/1000;
  const unchanged=JSON.stringify({pads:layout.pads,tracks:layout.tracks.filter(t=>t.origin!=='router'),barrels:layout.barrels})===retained;
  const row={mode,repeat,seconds,result,incomplete:requiredConnections(layout).length,violations:checkDrc(layout).counts.violations,unchanged,layout,ses:writeSes(layout)};
  if(!unchanged||row.violations)throw Error('Quality regression');
  rows.push(row);console.log(JSON.stringify({mode,repeat,seconds,incomplete:row.incomplete,status:result.targets.map((t:any)=>t.status)}));
 }
}
writeFileSync(out,JSON.stringify({scope:'Recovery-only synthetic fixture, engine exact geometry; no native DRC claim',rows},null,2)+'\n');
