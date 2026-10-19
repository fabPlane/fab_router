/** Explicit research invocation; never called by production. Unused output required. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,checkDrc,writeSes} from '../../../src/api.ts';
import {resolveSettings} from '../../../src/pipeline/index.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {buildLattice,padBoundsOn} from '../../../src/lattice/index.ts';
import {createJournal} from '../../../src/route/journal.ts';
import {scheduleRecovery} from './recovery-schedule.ts';
import {proposeVisibility} from './visibility-recovery.ts';
import type {RouteSettings} from '../../../spec/types/settings.ts';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected UNUSED_OUTPUT');
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')) as {input_sha256:string;kept:number[];settings:Partial<RouteSettings>};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(input)!==fixture.input_sha256)throw Error('Changed fixture');
const rows=[];
for(const context of ['reduced','original'])for(let repeat=0;repeat<3;repeat++){
 const read=readDsn(input);if(!read.ok)throw Error('parse');const l=read.layout,target=4;
 if(context==='reduced'){l.pads=l.pads.filter(p=>fixture.kept.includes(p.id));l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>fixture.kept.includes(id))}));}
 const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1;
 l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
 l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
 const settings=resolveSettings({...fixture.settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)},undefined,l.angleMode);
 const start=performance.now(),report=route(l,settings),normalSeconds=(performance.now()-start)/1000;
 const before=requiredConnections(l).filter(c=>c.net===target),ses=writeSes(l);
 const beforeVias=l.barrels.length,beforeLengthMm=l.tracks.reduce((n,t)=>n+t.pts.slice(1).reduce((a,p,i)=>a+Math.hypot(p.x-t.pts[i]!.x,p.y-t.pts[i]!.y),0),0)/(l.frame.luPerUm*1000);
 if(report.aborted||report.timedOut||checkDrc(l).counts.violations||before.length!==1||before[0]!.from!==10||before[0]!.to!==62)throw Error('Changed control');
 const lattice=buildLattice(l),journal=createJournal(l,lattice),profile=resolveProfile(l,target,settings),mark=journal.mark();
 const proposals:ReturnType<typeof proposeVisibility>[]=[];
 const plan={enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000};
 const began=performance.now();
 // Collect real current incomplete pad pairs; recheck connectivity in scheduler.
 const results=before.map(pair=>scheduleRecovery(l,lattice,journal,pair,plan,t=>{proposals.push(proposeVisibility(l,lattice,journal,pair,profile,t));}));
 const recoverySeconds=(performance.now()-began)/1000,after=requiredConnections(l).filter(c=>c.net===target),violations=checkDrc(l).counts.violations;
 if(violations)throw Error('DRC');
 const tracks=l.tracks.filter(t=>t.origin==='router');
 if(results.every(r=>r.status!=='kept')&&writeSes(l)!==ses)throw Error('Miss mutated session');
 rows.push({context,repeat,luPerUm:l.frame.luPerUm,beforeVias,beforeLengthMm,normalSeconds,recoverySeconds,before,after,violations,results,proposals,profile,
  beforeSha256:hash(ses),afterSha256:hash(writeSes(l)),tracks,
  pads:l.pads.map(p=>({id:p.id,net:p.net,at:p.at,boundsBySheet:profile.sheets.map(sheet=>({sheet,bounds:padBoundsOn(l,p,sheet)}))})),
  vias:l.barrels.length,lengthMm:tracks.reduce((n,t)=>n+t.pts.slice(1).reduce((a,p,i)=>a+Math.hypot(p.x-t.pts[i]!.x,p.y-t.pts[i]!.y),0),0)/(l.frame.luPerUm*1000)});
 journal.rewind(mark);if(writeSes(l)!==ses||journal.insertedSince(mark).length)throw Error('Cleanup');
 console.log(JSON.stringify({context,repeat,normalSeconds,recoverySeconds,before:before.length,after:after.length,status:results.map(r=>r.status),expansions:results.map(r=>r.expansions)}));
}
writeFileSync(out,JSON.stringify({scope:'Engine-only isolated target-net search; no native DRC/whole-board completion claim',inputSha256:hash(input),rows},null,2)+'\n');
