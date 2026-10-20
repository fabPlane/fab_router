/** Explicit research invocation; never called by production. Unused output required. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,checkDrc,writeSes} from '../../../src/api.ts';
import {resolveSettings} from '../../../src/pipeline/index.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {padBoundsOn} from '../../../src/lattice/index.ts';
import {recoverRemaining} from './recover-remaining.ts';

import type {RouteSettings} from '../../../spec/types/settings.ts';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected UNUSED_OUTPUT');
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')) as {input_sha256:string;kept:number[];settings:Partial<RouteSettings>};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(input)!==fixture.input_sha256)throw Error('Changed fixture');
const rows=[];
for(const context of [process.argv[3]==='copper'?'whole-board-copper':'whole-board'])for(let repeat=0;repeat<3;repeat++){
 const read=readDsn(input);if(!read.ok)throw Error('parse');const l=read.layout,target=4;
 const settings=resolveSettings(fixture.settings,undefined,l.angleMode);
 const start=performance.now(),report=route(l,settings),normalSeconds=(performance.now()-start)/1000;
 const before=requiredConnections(l),ses=writeSes(l);
 const beforeVias=l.barrels.length,beforeLengthMm=l.tracks.reduce((n,t)=>n+t.pts.slice(1).reduce((a,p,i)=>a+Math.hypot(p.x-t.pts[i]!.x,p.y-t.pts[i]!.y),0),0)/(l.frame.luPerUm*1000);
 if(report.aborted||report.timedOut||checkDrc(l).counts.violations)throw Error('Changed control');
 const profile=resolveProfile(l,target,settings),beforeTracks=structuredClone(l.tracks);
 const began=performance.now();
 const results=recoverRemaining(l,settings,true,16,process.argv[3]==='copper');
 const recoverySeconds=(performance.now()-began)/1000,after=requiredConnections(l),violations=checkDrc(l).counts.violations;
 if(violations)throw Error('DRC');
 const tracks=l.tracks.filter(t=>t.origin==='router');
 if(results.targets.every(r=>r.status!=='kept')&&writeSes(l)!==ses)throw Error('Miss mutated session');
 rows.push({context,repeat,luPerUm:l.frame.luPerUm,beforeVias,beforeLengthMm,normalSeconds,recoverySeconds,before,after,violations,results,profile,beforeTracks,beforeSes:ses,afterSes:writeSes(l),normalReport:report,
  beforeSha256:hash(ses),afterSha256:hash(writeSes(l)),tracks,
  pads:l.pads.map(p=>({id:p.id,net:p.net,at:p.at,boundsBySheet:profile.sheets.map(sheet=>({sheet,bounds:padBoundsOn(l,p,sheet)}))})),
  vias:l.barrels.length,lengthMm:tracks.reduce((n,t)=>n+t.pts.slice(1).reduce((a,p,i)=>a+Math.hypot(p.x-t.pts[i]!.x,p.y-t.pts[i]!.y),0),0)/(l.frame.luPerUm*1000)});
 console.log(JSON.stringify({context,repeat,normalSeconds,recoverySeconds,before:before.length,after:after.length,results}));
}
writeFileSync(out,JSON.stringify({scope:'Engine-only all-net post-pass search; no native DRC claim',inputSha256:hash(input),rows},null,2)+'\n');
