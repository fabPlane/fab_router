/** Observe scratch generators only; skip search. No production edits or copper. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const [source,native,out]=process.argv.slice(2);
if(!source||!native||!out)throw Error('SOURCE NATIVE OUT');
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const generators:any={};
for(const mode of ['before','after']){
 const file=resolve(source,mode,'src/route/visibility-recovery.ts'),text=readFileSync(file,'utf8'),marker='totalNodes+=nodes.length;';
 if(text.split(marker).length!==2)throw Error('Marker');
 const observed=text.replace(marker,marker+'(globalThis as any).__appendNodes=nodes;continue;').replace(/from '([^']+)'/g,(_,p)=>`from '${resolve(dirname(file),p)}'`);
 const dest=resolve(source,mode,'observe.ts');writeFileSync(dest,observed);
 generators[mode]=(await import(dest)).proposeVisibility;
}
const api=await import(resolve(source,'before/src/api.ts'));
const {resolveSettings}=await import(resolve(source,'before/src/pipeline/index.ts'));
const {resolveProfile}=await import(resolve(source,'before/src/route/profile.ts'));
const census=JSON.parse(gunzipSync(readFileSync(resolve(import.meta.dir,'../candidate-coverage/results.json.gz'))).toString());
const selected=census.rows.filter((r:any)=>r.case.includes('paperino')&&[0,4,8,16].includes(r.margin));
if(selected.length!==16)throw Error('Expected 16 saved-target graphs');
const inputs=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8'));
const input=inputs.find((r:any)=>r.seed===1&&r.case===selected[0].case),work=resolve(native,input.evidence,'work');
const dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
const parsed=api.readDsn(dsn);if(!parsed.ok||!api.applySes(parsed.layout,ses).ok)throw Error('Input');
const layout=parsed.layout,before=api.writeSes(layout),summary=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8'));
const settings=resolveSettings(summary.result.report.effectiveSettings,undefined,layout.angleMode);
const rows=[];
for(const row of selected){
 const profile={...resolveProfile(layout,row.target.net,settings),sheets:[row.sheet]};
 const nodes:any={},generationWork:any={};
 for(const mode of ['before','after']){
  (globalThis as any).__appendNodes=undefined;let charged=0;
  generators[mode](layout,undefined,undefined,row.target,profile,{region:row.region,expand(){charged++;}},512,true);
  nodes[mode]=(globalThis as any).__appendNodes;generationWork[mode]=charged;
  if(!nodes[mode]||nodes[mode].length>512)throw Error('Cap');
 }
 if(nodes.before.length!==row.nodes||sha(nodes.before)!==row.nodeSha256)throw Error('Historical parity');
 if(sha(nodes.after.slice(0,nodes.before.length))!==sha(nodes.before))throw Error('Prefix lost');
 if(nodes.after.length<nodes.before.length)throw Error('Coverage lost');
 rows.push({target:row.target,margin:row.margin,sheet:row.sheet,region:row.region,nodes,generationWork});
}
if(api.writeSes(layout)!==before||api.checkDrc(layout).counts.violations)throw Error('Read-only invariant');
writeFileSync(out,JSON.stringify({scope:'Uncharged observer skips search; 16 fixed graphs, not reached production trials',dsnSha256:createHash('sha256').update(dsn).digest('hex'),sesSha256:createHash('sha256').update(ses).digest('hex'),unchanged:true,rows},null,2)+'\n');
console.log(JSON.stringify({graphs:rows.length,prefixesPreserved:rows.length,enriched:rows.filter(r=>r.nodes.after.length>r.nodes.before.length).length,unchanged:true}));
