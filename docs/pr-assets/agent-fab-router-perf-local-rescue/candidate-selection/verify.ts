/** Independently observe production candidate arrays, stopping before graph search.
 * Instrument a scratch copy only; no production files are written.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes} from '../../../../src/api.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {makeCandidate} from './select.ts';
const [native,census,scratch]=process.argv.slice(2);if(!native||!census||!scratch)throw Error('NATIVE CENSUS SCRATCH');
const source=resolve(import.meta.dir,'../../../../src/route/visibility-recovery.ts');
const original=readFileSync(source,'utf8'),marker='totalNodes+=nodes.length;';
if(original.split(marker).length!==2)throw Error('Source marker changed');
const instrumented=original.replace('nodes.length<maxNodes','true').replace(marker,marker+'globalThis.__coverageNodes=nodes;continue;').replace(/from '([^']+)'/g,(_,p)=>`from '${resolve(dirname(source),p)}'`);
const file=resolve(scratch,'observe-production.ts');writeFileSync(file,instrumented);
const {proposeVisibility}=await import(file);
await makeCandidate(scratch);
const selectedFile=resolve(scratch,'selected-visibility.ts'),selectedSource=readFileSync(selectedFile,'utf8');
const observedFile=resolve(scratch,'observe-selected.ts');
writeFileSync(observedFile,selectedSource.replace(marker,marker+'globalThis.__coverageNodes=nodes;continue;'));
const selected=(await import(observedFile)).proposeVisibility;
const rows=JSON.parse(readFileSync(census,'utf8')).rows;
const inputs=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8'));
let verified=0;
for(const name of new Set(rows.map((r:any)=>r.case))){
 const input=inputs.find((r:any)=>r.case===name&&r.seed===1),work=resolve(native,input.evidence,'work');
 const p=readDsn(readFileSync(resolve(work,'board.dsn'),'utf8'));if(!p.ok)throw Error('Parse');if(!applySes(p.layout,readFileSync(resolve(work,'board.ses'),'utf8')).ok)throw Error('Session');
 const summary=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8')),settings=resolveSettings(summary.result.report.effectiveSettings,undefined,p.layout.angleMode);
 for(const row of rows.filter((r:any)=>r.case===name)){
  const profile={...resolveProfile(p.layout,row.target.net,settings),sheets:[row.sheet]};
  globalThis.__coverageNodes=undefined;
  // Generation uses neither lattice nor journal. Instrumentation skips search.
  proposeVisibility(p.layout,undefined,undefined,row.target,profile,{region:row.region,expand(){}},512,true);
  const all=globalThis.__coverageNodes;
  if(!all)throw Error('Missing full generation');
  const rank=(p:any)=>Math.hypot(p.x-all[0].x,p.y-all[0].y)+Math.hypot(p.x-all[1].x,p.y-all[1].y);
  const ranked=all.slice(2).sort((a:any,b:any)=>rank(a)-rank(b)||a.x-b.x||a.y-b.y);
  for(const cap of [2,3,16,512]){
   let work=0;globalThis.__coverageNodes=undefined;
   selected(p.layout,undefined,undefined,row.target,profile,{region:row.region,expand(){work++;}},cap,true);
   const actual=globalThis.__coverageNodes,expected=[...all.slice(0,2),...ranked.slice(0,cap-2)];
   if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Selection mismatch '+cap);
   if(new Set(actual.map((p:any)=>p.x+','+p.y)).size!==actual.length)throw Error('Duplicate');
   // Mid-generation exhaustion must propagate; no partial node graph is searched.
   const stop=Symbol('stop');globalThis.__coverageNodes=undefined;let charged=0,stopped=false;
   try{selected(p.layout,undefined,undefined,row.target,profile,{region:row.region,expand(){if(++charged===Math.max(1,Math.floor(work/2)))throw stop;}},cap,true);}catch(e){if(e!==stop)throw e;stopped=true;}
   if(!stopped||globalThis.__coverageNodes!==undefined)throw Error('Budget did not stop generation');
   verified++;
  }
 }
}
console.log(JSON.stringify({verified,sourceSha256:createHash('sha256').update(original).digest('hex'),scope:'All 72 graphs and four caps match independent exhaustive rank; mid-generation stop propagates. Unbounded read-only validation, not production work or search.'}));
