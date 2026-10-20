import {resolve} from 'node:path';
import {strict as assert} from 'node:assert';
const root=resolve(process.argv[2]!);
const {emptyLayout,makeSpacingTable}=await import(root+'/src/layout/index.ts');
const {buildLattice}=await import(root+'/src/lattice/index.ts');
const {createJournal}=await import(root+'/src/route/journal.ts');
const {resolveSettings}=await import(root+'/src/pipeline/index.ts');
const {resolveProfile}=await import(root+'/src/route/profile.ts');
const {checkDrc,requiredConnections,writeSes}=await import(root+'/src/api.ts');
const {scheduleRecovery}=await import(root+'/src/route/recovery-schedule.ts');
const {proposeVisibility}=await import(root+'/src/route/visibility-recovery.ts');
const mode=process.argv[3];assert.ok(mode==='before'||mode==='after');
const rows=[];
for(const source of ['kind','sheet','rule'])for(const obstacle of ['pad','track','barrel'])for(const budget of [10,1000]){
 const l=emptyLayout('local-spacing-regression');
 l.spacing=makeSpacingTable(['null','default','unused'],2,[],(a,b,s)=>source==='kind'&&(a===2||b===2)||source==='sheet'&&s===1||source==='rule'?3000:100);
 l.stack=[0,1].map(id=>({id,name:`sheet${id}`,role:'signal',active:true,preferDir:null}));
 l.netGroups=[{id:0,name:'default',nets:[0,1],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1}}];
 l.padForms=[{id:0,name:'disk',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:500}]]])}];
 l.pads=[{x:0,y:0},{x:10000,y:0},...(obstacle==='pad'?[{x:5000,y:0}]:[])].map((at,id)=>({id,part:0,pinName:String(id),net:id===2?1:0,form:0,at,rotationDeg:0,side:'front',sheets:[0],kind:1,hold:'locked'}));
 l.nets=[{id:0,name:'target',group:0,pads:[0,1]},{id:1,name:'obstacle',group:0,pads:obstacle==='pad'?[2]:[]}];
 if(obstacle==='track')l.tracks=[{id:2,net:1,sheet:0,pts:[{x:4800,y:0},{x:5200,y:0}],width:1000,kind:1,hold:'locked'}];
 if(obstacle==='barrel')l.barrels=[{id:2,net:1,at:{x:5000,y:0},form:0,kind:1,hold:'locked',fromSheet:0,toSheet:0}];
 const lattice=buildLattice(l),journal=createJournal(l,lattice),profile=resolveProfile(l,0,resolveSettings({},undefined,l.angleMode));
 assert.equal(profile.maxSpacing,3000);assert.equal(l.spacing.get(profile.trackKind,1,0),source==='rule'?3000:100);
 assert.equal(checkDrc(l).counts.violations,0);assert.equal(requiredConnections(l).length,1);
 const before=writeSes(l),retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels}),mark=journal.mark();
 const result=scheduleRecovery(l,lattice,journal,{net:0,from:0,to:1},{enabled:true,pitch:1200,margins:[0,1],maxAttempts:2,maxExpansions:budget,maxMilliseconds:10000},t=>{proposeVisibility(l,lattice,journal,{net:0,from:0,to:1},profile,t,512,true);});
 const remaining=requiredConnections(l).length;
 assert.equal(checkDrc(l).counts.violations,0);
 if(budget===10){assert.equal(result.status,'budget');assert.equal(result.expansions,10);assert.equal(writeSes(l),before);}
 if(budget===1000)assert.equal(result.status,mode==='after'&&source!=='rule'?'kept':'exhausted');
 if(result.status==='kept'){assert.equal(remaining,0);assert.equal(l.tracks.at(-1)!.width,200);}
 else {assert.equal(remaining,1);assert.equal(writeSes(l),before);}
 rows.push({source,obstacle,budget,status:result.status,remaining,expansions:result.expansions,exact:0,path:result.status==='kept'?l.tracks.at(-1)!.pts:[]});
 journal.rewind(mark);assert.equal(writeSes(l),before);assert.equal(JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels}),retained);assert.equal(checkDrc(l).counts.violations,0);assert.equal(requiredConnections(l).length,1);
}
console.log(JSON.stringify(rows,null,2));
