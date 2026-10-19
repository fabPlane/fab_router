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
const target=4;
const read=readDsn(input);if(!read.ok)throw Error('Read failed');
const originalIds=read.layout.pads.map(p=>p.id);
const terminalIds=read.layout.pads.filter(p=>p.net===target).map(p=>p.id);
let kept=[...originalIds];
const trials:unknown[]=[];
function trial(ids:number[]){
 const parsed=readDsn(input);if(!parsed.ok)throw Error('Read failed');const l=parsed.layout;
 l.pads=l.pads.filter(p=>ids.includes(p.id));
 l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>ids.includes(id))}));
 const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1;
 l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
 l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
 const effective={...settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)};
 const before=requiredConnections(l).filter(c=>c.net===target);
 const started=performance.now(),report=route(l,effective),seconds=(performance.now()-started)/1000;
 const after=requiredConnections(l).filter(c=>c.net===target),drc=checkDrc(l);
 const reproduces=!report.timedOut&&!report.aborted&&report.violationsAdded===0&&drc.counts.violations===0&&before.length===2&&after.length===1&&after[0]?.from===10&&after[0]?.to===62;
 const row={ids,before,after,seconds,report,drc,ses_sha256:hash(writeSes(l)),reproduces};
 trials.push(row);console.log(JSON.stringify({pads:ids.length,reproduces,seconds}));return row;
}
if(!trial(kept).reproduces)throw Error('Initial context does not reproduce');
// Deterministic coarse deletion then a single ordered deletion sweep. Not a proof of global minimality.
for(const chunk of [16,8,4,2,1]){
 const candidates=kept.filter(id=>!terminalIds.includes(id));
 for(let i=0;i<candidates.length;i+=chunk){
  const drop=candidates.slice(i,i+chunk),next=kept.filter(id=>!drop.includes(id));
  if(trial(next).reproduces)kept=next;
 }
}
const finals=[trial(kept),trial(kept),trial(kept)];
if(finals.some(r=>!r.reproduces)||new Set(finals.map(r=>r.ses_sha256)).size!==1)throw Error('Non deterministic final fixture');
writeFileSync(out,JSON.stringify({scope:'Engine-only deletion reduction. No native validation, global minimum or physical impossibility claim.',input_sha256:hash(input),settings,terminalIds,kept,trials,finals},null,2)+'\n');
