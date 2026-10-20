/** Offline alternate point-component anchors. Not production scheduling. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes,requiredConnections,checkDrc,writeSes} from '../../../../src/api.ts';
import {buildLattice,barrelSheets} from '../../../../src/lattice/index.ts';
import {connectivity} from '../../../../src/drc/connect.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {scheduleRecovery} from '../../../../src/route/recovery-schedule.ts';
import {proposeVisibility} from '../../../../src/route/visibility-recovery.ts';
const [native,out,filter,seedArg]=process.argv.slice(2);if(!native||!out||existsSync(out))throw Error('NATIVE UNUSED_OUTPUT [CASE]');mkdirSync(out);
const attempts=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8'));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex'),rows=[];
for(const a of attempts.filter((a:any)=>a.seed===Number(seedArg??1)&&a.opens!==0&&(!filter||a.case===filter))){
 const work=resolve(native,a.evidence,'work');
 if(!existsSync(resolve(work,'board.ses')))continue;
 const dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
 const settings=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8')).result.report.effectiveSettings;
 const r=readDsn(dsn);if(!r.ok)throw Error('parse');const l=r.layout;if(!applySes(l,ses).ok)throw Error('ses');
 if(checkDrc(l).counts.violations)throw Error('dirty');
 const lattice=buildLattice(l),journal=createJournal(l,lattice),pending=requiredConnections(l),before=writeSes(l);
 const fixed=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]);
 const caseRows=[];
 for(const pair of pending.slice(0,16)){
  const c=connectivity(l,lattice),profile=resolveProfile(l,pair.net,settings);
  const points=[...l.pads.map(p=>({id:p.id,net:p.net,at:p.at,sheets:p.sheets})),...l.barrels.map(b=>({id:b.id,net:b.net,at:b.at,sheets:barrelSheets(l,b)}))];
  const from=points.filter(p=>p.net===pair.net&&c.componentOf.get(p.id)===c.componentOf.get(pair.from));
  const to=points.filter(p=>p.net===pair.net&&c.componentOf.get(p.id)===c.componentOf.get(pair.to));
  const pairs=from.flatMap(a=>to.filter(b=>a.sheets.some(s=>b.sheets.includes(s)&&profile.sheets.includes(s))).map(b=>({from:a.id,to:b.id,net:pair.net,distance:Math.hypot(a.at.x-b.at.x,a.at.y-b.at.y)}))).sort((a,b)=>a.distance-b.distance||a.from-b.from||a.to-b.to).slice(0,8);
  const trials=[];
  for(const anchor of pairs){
   const saved=writeSes(l),start=performance.now(),proposals:any[]=[];
   const result=scheduleRecovery(l,lattice,journal,pair,{enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000},trial=>{proposals.push(proposeVisibility(l,lattice,journal,anchor,profile,trial,512,true));},{},anchor);
   trials.push({anchor,result,proposals,seconds:(performance.now()-start)/1000});
   console.log(a.case,pair.from,pair.to,anchor.from,anchor.to,result.status);
   if(result.status==='kept')break;
   if(writeSes(l)!==saved)throw Error('Failed trial changed session');
  }
  caseRows.push({pair,fromCount:from.length,toCount:to.length,trials});
 }
 const after=writeSes(l),exact=checkDrc(l).counts;
 if(exact.violations)throw Error('exact');
 const preserved=JSON.stringify([l.pads,l.pours,l.fences,l.tracks.slice(0,JSON.parse(fixed)[3].length),l.barrels]);if(preserved!==fixed)throw Error('Retention');
 writeFileSync(resolve(out,a.case+'-before.ses'),before);writeFileSync(resolve(out,a.case+'-after.ses'),after);
 rows.push({case:a.case,dsnSha256:sha(dsn),inputSesSha256:sha(ses),settings,pending,remaining:requiredConnections(l),exact,beforeSha256:sha(before),afterSha256:sha(after),targets:caseRows});
 writeFileSync(resolve(out,'probe.json'),JSON.stringify({scope:'Offline residual alternate-anchor diagnostic, one repeat, no native score',seed:Number(seedArg??1),rows},null,2)+'\n');
}
