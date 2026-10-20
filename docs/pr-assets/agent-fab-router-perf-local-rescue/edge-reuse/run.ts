/** Invoke the real bounded coordinator on one live layout per mode/repeat. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [source,native,out]=process.argv.slice(2);if(!source||!native||!out||existsSync(out))throw Error('SOURCE NATIVE UNUSED_OUT');
const {readDsn,applySes,writeSes,checkDrc,requiredConnections}=await import(resolve(source,'src/api.ts'));
const {resolveSettings}=await import(resolve(source,'src/pipeline/index.ts'));
const {recoverPointComponent}=await import(resolve(source,'src/route/recovery-point-component.ts'));
const {buildLattice}=await import(resolve(source,'src/lattice/index.ts'));
const {createJournal}=await import(resolve(source,'src/route/journal.ts'));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const rows=[];
for(const input of JSON.parse(readFileSync(resolve(native,'results.json'),'utf8')).filter((r:any)=>r.seed===1&&r.case.includes('paperino')&&r.opens>0&&r.opens<=10)){
 const work=resolve(native,input.evidence,'work'),dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
 const parsed=readDsn(dsn);if(!parsed.ok||!applySes(parsed.layout,ses).ok)throw Error('Input');const l=parsed.layout;
 const summary=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8'));
 const settings=resolveSettings(summary.result.report.effectiveSettings,undefined,l.angleMode);
 const metrics=()=>({vias:l.barrels.length,lengthLu:l.tracks.reduce((sum:any,t:any)=>sum+t.pts.slice(1).reduce((n:any,p:any,i:any)=>n+Math.hypot(p.x-t.pts[i].x,p.y-t.pts[i].y),0),0),tracks:l.tracks.length});
 const copperBefore=metrics();
 const before=writeSes(l),targets=requiredConnections(l),lattice=buildLattice(l),journal=createJournal(l,lattice),mark=journal.mark();
 if(checkDrc(l).counts.violations)throw Error('Baseline exact');
 const attempts=[];
 for(const target of targets){
  const prior=writeSes(l),remainingBefore=requiredConnections(l).length;
  (globalThis as any).__edgeReuse=[];
  const result=recoverPointComponent(l,settings,target,{}, {resources:{lattice,journal}});
  const exact=checkDrc(l).counts.violations,remainingAfter=requiredConnections(l).length;
  if(exact||result.work>100000||remainingAfter>remainingBefore)throw Error('Invariant');
  if(!['kept','joined'].includes(result.status)&&writeSes(l)!==prior)throw Error('Rollback');
  const trace=(globalThis as any).__edgeReuse;
  attempts.push({trace,target,result,remainingBefore,remainingAfter,exact,sessionSha256:sha(writeSes(l))});
 }
 const copperAfter=metrics();
 const final=writeSes(l),remaining=requiredConnections(l).length;
 journal.rewind(mark);if(writeSes(l)!==before||checkDrc(l).counts.violations)throw Error('Rewind');
 rows.push({case:input.case,dsnSha256:sha(dsn),inputSesSha256:sha(ses),copperBefore,copperAfter,before:targets.length,after:remaining,changed:final!==before,finalSesSha256:sha(final),rewind:true,attempts});
}
writeFileSync(out,JSON.stringify({scope:'Saved residual coordinator experiment; not native benchmark',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({case:r.case,before:r.before,after:r.after,status:r.attempts.map(a=>a.result.status),work:r.attempts.map(a=>a.result.work)}))));
