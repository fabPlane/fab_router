/** Offline residual experiment. No production imports this driver.
 * Compare input-order corners with bounded endpoint-distance heap selection.
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes,writeSes,checkDrc,requiredConnections} from '../../../../src/api.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {buildLattice} from '../../../../src/lattice/index.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {recoveryEndpoint} from '../../../../src/route/recovery-endpoint.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {scheduleRecovery} from '../../../../src/route/recovery-schedule.ts';
import {proposeVisibility} from '../../../../src/route/visibility-recovery.ts';
import {makeCandidate} from './select.ts';
const [native,out]=process.argv.slice(2);
if(!native||!out||existsSync(out))throw Error('NATIVE_RUN UNUSED_OUTPUT');
mkdirSync(out,{recursive:true});
const selected=await makeCandidate(out);
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const cases=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8')).filter((r:any)=>r.seed===1&&r.opens>0&&r.opens<=10);
const rows:any[]=[];
for(const row of cases){
 const work=resolve(native,row.evidence,'work');
 const dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
 const summary=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8'));
 const load=()=>{const p=readDsn(dsn);if(!p.ok)throw Error('Parse');if(!applySes(p.layout,ses).ok)throw Error('Session');return p.layout;};
 const original=load(),baselineDrc=checkDrc(original).counts.violations;
 if(baselineDrc){rows.push({case:row.case,skipped:'nonzero exact baseline',baselineDrc});continue;}
 const targets=requiredConnections(original);
 if(!targets.length){rows.push({case:row.case,skipped:'no engine residuals after session import',nativeOpens:row.opens,dsnSha256:sha(dsn),inputSesSha256:sha(ses)});continue;}
 for(const target of targets){
  if(!recoveryEndpoint(original,target.from,target.net)||!recoveryEndpoint(original,target.to,target.net)){
   rows.push({case:row.case,target,skipped:'unsupported point pair'});continue;
  }
  for(let repeat=1;repeat<=3;repeat++)for(const mode of (repeat%2?['before','after']:['after','before'])){
   const l=load(),settings=resolveSettings(summary.result.report.effectiveSettings,undefined,l.angleMode);
   const lattice=buildLattice(l),journal=createJournal(l,lattice),profile=resolveProfile(l,target.net,settings);
   const before=writeSes(l),beforeGeometry=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]);
   const beforeOpen=requiredConnections(l).length;
   const margins=[0,4,8,16];
   const proposals:unknown[]=[];const start=performance.now();
   const result=scheduleRecovery(l,lattice,journal,target,{enabled:true,pitch:profile.width+profile.maxSpacing,margins,maxAttempts:margins.length,maxExpansions:100000,maxMilliseconds:15000},trial=>{
    proposals.push((mode==='before'?proposeVisibility:selected)(l,lattice,journal,target,profile,trial,512,true));
   });
   const seconds=(performance.now()-start)/1000,after=writeSes(l),afterOpen=requiredConnections(l).length,exact=checkDrc(l).counts.violations;
   const rollbackUnchanged=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels])===beforeGeometry;
   if(exact||afterOpen>beforeOpen||(result.status!=='kept'&&!rollbackUnchanged))throw Error('Exact/rollback invariant');
   const record={case:row.case,target,repeat,mode,margins,beforeOpen,afterOpen,exact,seconds,result,proposals,rollbackUnchanged,dsnSha256:sha(dsn),inputSesSha256:sha(ses),beforeSha256:sha(before),afterSha256:sha(after)};
   rows.push(record);writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Static residual point probes, not full routes or native scores; alternatives are not retried',rows},null,2)+'\n');
   console.log(JSON.stringify({case:row.case,target,repeat,mode,status:result.status,beforeOpen,afterOpen,seconds,expansions:result.expansions}));
  }
 }
}
writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Static residual point probes, not full routes or native scores; alternatives are not retried',rows},null,2)+'\n');
