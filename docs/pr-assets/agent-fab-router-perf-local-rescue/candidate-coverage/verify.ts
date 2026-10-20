/** Independently observe production candidate arrays, stopping before graph search.
 * Instrument a scratch copy only; no production files are written.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes} from '../../../../src/api.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
const [native,census,scratch]=process.argv.slice(2);if(!native||!census||!scratch)throw Error('NATIVE CENSUS SCRATCH');
const source=resolve(import.meta.dir,'../../../../src/route/visibility-recovery.ts');
const original=readFileSync(source,'utf8'),marker='totalNodes+=nodes.length;';
if(original.split(marker).length!==2)throw Error('Source marker changed');
const instrumented=original.replace(marker,marker+'globalThis.__coverageNodes=nodes;continue;').replace(/from '([^']+)'/g,(_,p)=>`from '${resolve(dirname(source),p)}'`);
const file=resolve(scratch,'observe-production.ts');writeFileSync(file,instrumented);
const {proposeVisibility}=await import(file);
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
  const nodes=globalThis.__coverageNodes;
  if(!nodes||nodes.length!==row.nodes||createHash('sha256').update(JSON.stringify(nodes)).digest('hex')!==row.nodeSha256)throw Error('Node mismatch');verified++;
 }
}
console.log(JSON.stringify({verified,sourceSha256:createHash('sha256').update(original).digest('hex'),scope:'Scratch instrumentation skips search; production candidate coordinates and order match census'}));
