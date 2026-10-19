/** Re-run only recovery on the real native control's residual layout. No native score. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [before,after,native,out]=process.argv.slice(2);
if(!before||!after||!native||!out||existsSync(out))throw Error('Expected BEFORE AFTER NATIVE_BEFORE UNUSED_OUTPUT');
const attempts=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8'));
const a=attempts.find((r:any)=>r.case==='rufs-smart-psu-j4'&&r.seed===1);if(!a)throw Error('Missing case');
const work=resolve(native,a.evidence,'work'),dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
const settings=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8')).result.report.effectiveSettings;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),rows=[];
for(const [mode,root]of [['before',before],['after',after]]){
 const load=(p:string)=>import(pathToFileURL(resolve(root!,p)).href);
 const api=await load('src/api.ts'),{recoverRemaining}=await load('src/route/recover-remaining.ts');
 const sessions=[];
 for(let repeat=1;repeat<=3;repeat++){
  const r=api.readDsn(dsn);if(!r.ok)throw Error('Parse');const l=r.layout;if(!api.applySes(l,ses).ok)throw Error('Session');
  const retained=JSON.stringify([l.pads,l.pours,l.barrels,l.tracks]);
  const oldTracks=new Map<number,string>(l.tracks.map((t:any)=>[t.id,JSON.stringify(t)]));
  const oldBarrels=JSON.stringify(l.barrels),oldPads=JSON.stringify(l.pads),oldPours=JSON.stringify(l.pours),original=api.writeSes(l);
  const pending=api.requiredConnections(l);if(pending.length!==1||api.checkDrc(l).counts.violations)throw Error('Unexpected baseline');
  const start=performance.now(),result=recoverRemaining(l,settings,true,16,true),seconds=(performance.now()-start)/1000;
  const remaining=api.requiredConnections(l),exact=api.checkDrc(l).counts.violations,output=api.writeSes(l);
  if(exact||l.barrels.length!==JSON.parse(oldBarrels).length||oldBarrels!==JSON.stringify(l.barrels)||oldPads!==JSON.stringify(l.pads)||oldPours!==JSON.stringify(l.pours))throw Error('Preservation');
  for(const [id,bytes]of oldTracks)if(JSON.stringify(l.tracks.find((t:any)=>t.id===id))!==bytes)throw Error('Track changed');
  if(mode==='before'&&(remaining.length!==1||output!==original||JSON.stringify([l.pads,l.pours,l.barrels,l.tracks])!==retained))throw Error('Control');
  if(mode==='after'&&(remaining.length!==0||result.targets[0]?.status!=='kept'||result.targets[0]?.anchorPair?.to!==75))throw Error('No closure');
  const row={mode,repeat,seconds,pending,remaining,exact,result,retainedTracks:oldTracks.size,retainedBarrels:l.barrels.length,sesSha256:hash(output),addedTracks:l.tracks.filter((t:any)=>!oldTracks.has(t.id))};
  rows.push(row);sessions.push(row.sesSha256);console.log(JSON.stringify(row));
 }
 if(new Set(sessions).size!==1)throw Error('Nondeterministic');
}
writeFileSync(out,JSON.stringify({scope:'Real prepared native residual, recovery-only, 3 repeats/source; no fresh native score',dsnSha256:hash(dsn),sesSha256:hash(ses),settings,rows},null,2)+'\n');
