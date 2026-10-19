/** Full-pipeline context isolation; never changes spacing, widths or search code.
 * bun isolate-endpoint.ts NATIVE_WORK UNUSED_OUTPUT
 */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readDsn,route,applySes,requiredConnections,checkDrc,writeSes} from '../../../src/api.ts';
import type {Layout} from '../../../spec/types/layout.ts';
import type {RouteSettings} from '../../../spec/types/settings.ts';
const [work,out]=process.argv.slice(2);
if(!work||!out||existsSync(out))throw Error('Expected NATIVE_WORK UNUSED_OUTPUT');
const input=readFileSync(resolve(work,'board.dsn'),'utf8');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(input)!=='5a91aed89ceebc6a40ed3d222afd7f6e1660d62209023d10c79c2efeff15d8c1')throw Error('Wrong selected input');
const ses=readFileSync(resolve(work,'board.ses'),'utf8');
const settings=(JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8')) as {settings:Partial<RouteSettings>}).settings;
const target=4,ends=[10,62],blockers=[27,28,34,35,36,37];
const modes=['full-control','target-original-context','target-final-context','target-six-blockers'] as const;
const rows=[];
for(const mode of modes)for(let repeat=1;repeat<=3;repeat++){
 const read=readDsn(input);if(!read.ok)throw Error('Read failed');const l:Layout=read.layout;
 if(mode==='target-final-context'){
  const applied=applySes(l,ses);if(!applied.ok)throw Error('Session apply failed');
  l.tracks=l.tracks.map(t=>t.net===target?t:{...t,hold:'locked' as const});
  l.barrels=l.barrels.map(b=>b.net===target?b:{...b,hold:'locked' as const});
 }
 if(mode==='target-six-blockers'){
  l.pads=l.pads.filter(p=>ends.includes(p.id)||blockers.includes(p.id));
  l.tracks=[];l.barrels=[];l.pours=[];
  l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>l.pads.some(p=>p.id===id))}));
 }
 let effective={...settings};
 if(mode!=='full-control'){
  // Duplicate each original group for ignored nets. Physical kinds, widths and via rules stay identical.
  const offset=Math.max(...l.netGroups.map(g=>g.id))+1;
  const groups=l.netGroups;
  l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
  l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
  effective={...settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)};
 }
 const before=requiredConnections(l).filter(c=>c.net===target);
 const retained=JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.net!==target),barrels:l.barrels.filter(b=>b.net!==target),pours:l.pours});
 const drcBefore=checkDrc(l);
 const started=performance.now();const report=route(l,effective);const seconds=(performance.now()-started)/1000;
 const after=requiredConnections(l).filter(c=>c.net===target);
 const stable=retained===JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.net!==target),barrels:l.barrels.filter(b=>b.net!==target),pours:l.pours});
 if(mode!=='full-control'&&!stable)throw Error('Retained geometry changed');
 if(report.timedOut||report.aborted)throw Error('Incomplete diagnostic budget');
 if(mode==='full-control'&&hash(writeSes(l))!==hash(ses))throw Error('Original control session mismatch');
 rows.push({mode,repeat,seconds,pads:l.pads.length,settings:effective,before,after,report,drcBefore,drcAfter:checkDrc(l),retained_geometry_unchanged:stable,ses_sha256:hash(writeSes(l))});
 console.log(JSON.stringify({mode,repeat,seconds,before:before.length,after:after.length,addedViolations:report.violationsAdded}));
}
writeFileSync(out,JSON.stringify({scope:'Engine-only context isolation, not native DRC or a recovery change. Removed obstacles and changed scheduling are diagnostic interventions.',input_sha256:hash(input),reference_ses_sha256:hash(ses),target,ends,blockers,rows},null,2)+'\n');
