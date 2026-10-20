import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes,writeSes,checkDrc,requiredConnections} from '../../../../src/api.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {recoverPointComponent} from './recover.ts';
const [arg]=process.argv.slice(2);if(!arg||existsSync(arg))throw Error('UNUSED_OUTPUT required');mkdirSync(arg);
const root=new URL('../../../../test/data/',import.meta.url);
const fixture=JSON.parse(readFileSync(new URL('component-anchor-stall.json',root),'utf8'));
const dsn=readFileSync(new URL('component-anchor-stall.dsn',root),'utf8'),ses=readFileSync(new URL('component-anchor-stall.ses',root),'utf8');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
if(sha(dsn)!==fixture.dsnSha256||sha(ses)!==fixture.sesSha256)throw Error('Fixture identity');
const rows=[];
for(let repeat=1;repeat<=3;repeat++){
 const parsed=readDsn(dsn);if(!parsed.ok)throw Error('Parse');const l=parsed.layout;
 if(!applySes(l,ses).ok)throw Error('Session');
 const original=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]),tracks=l.tracks.length;
 const before=writeSes(l),beforeOpen=requiredConnections(l).length;
 const result=recoverPointComponent(l,resolveSettings(fixture.settings,undefined,l.angleMode),fixture.target);
 const after=writeSes(l),afterOpen=requiredConnections(l).length,exact=checkDrc(l).counts.violations;
 if(result.status!=='kept'||beforeOpen!==1||afterOpen!==0||exact||result.work>100000||
  JSON.stringify([l.pads,l.pours,l.fences,l.tracks.slice(0,tracks),l.barrels])!==original)throw Error('Recovery invariants');
 writeFileSync(resolve(arg,`repeat${repeat}-before.ses`),before);writeFileSync(resolve(arg,`repeat${repeat}-after.ses`),after);
 rows.push({repeat,beforeOpen,afterOpen,exact,beforeSha256:sha(before),afterSha256:sha(after),result});
}
if(new Set(rows.map(r=>r.afterSha256)).size!==1)throw Error('Nondeterministic sessions');
writeFileSync(resolve(arg,'results.json'),JSON.stringify({scope:'Three static residual engine replays; no fresh native checks or full routing scores',fixture,rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({repeat:r.repeat,work:r.result.work,enumeration:r.result.enumeration,attempts:r.result.attempts.map(a=>({anchor:a.anchor,status:a.result.status,expansions:a.result.expansions})),afterSha256:r.afterSha256})),null,2));
