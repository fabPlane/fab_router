/** Offline audit of original-pad blockers. No routing or layout mutations.
 * bun inspect-endpoint-blockers.ts NATIVE_ROOT TRIAL_RESULTS ENDPOINTS UNUSED_OUTPUT
 */
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import type {Pad} from '../../../spec/types/layout.ts';
import {readDsn} from '../../../src/api.ts';
import {padShapesOn} from '../../../src/lattice/index.ts';
import {coreOf,dist2Pts,type Pt,type Shape} from '../../../src/geom/index.ts';
const [root,trialsPath,endsPath,out]=process.argv.slice(2);
if(!root||!trialsPath||!endsPath||!out||existsSync(out))throw Error('Expected inputs and unused output');
type Hit={sheet:number;index:number;legs:number;seg:{a:Pt;b:Pt};width:number;blocking:number[]};
type Row={case:string;key:string;netId:number;trials:{id:number;kind:string;ok:boolean;blocked?:Hit[]}[]};
type End={case:string;key:string;input_sha256:string;source:{at:Pt};target:{at:Pt}};
const rows=JSON.parse(readFileSync(trialsPath,'utf8')) as Row[];
const ends=(JSON.parse(readFileSync(endsPath,'utf8')) as {rows:End[]}).rows;
const runs=JSON.parse(readFileSync(resolve(root,'results.json'),'utf8')) as {case:string;seed:number;evidence:string}[];
const equal=(a:Pt,b:Pt)=>a.x===b.x&&a.y===b.y;
type Metric={core_distance_squared:number;radius_sum:number;required:number;overlaps:boolean;below_rule:boolean};
const records:{case:string;key:string;trial:number;variant:number;segment:Hit;blocker:Pad;part:string|undefined;shapes:Shape[];metrics:Metric[];luPerUm:number}[]=[];let nonPad=0;
for(const row of rows){
 const end=ends.find(e=>e.case===row.case&&e.key===row.key);
 const run=runs.find(r=>r.case===row.case&&r.seed===1);if(!end||!run)throw Error('Missing provenance');
 const dsn=readFileSync(resolve(root,run.evidence,'work/board.dsn'),'utf8');
 if(createHash('sha256').update(dsn).digest('hex')!==end.input_sha256)throw Error('Input hash mismatch');
 const loaded=readDsn(dsn);if(!loaded.ok)throw Error('Invalid input');const l=loaded.layout;
 for(const t of row.trials){if(t.kind!=='insertTrail'||t.ok)continue;
 for(const [variant,b] of (t.blocked??[]).entries()){
 const pts:Pt[]=[];if(b.index===0)pts.push(b.seg.a);if(b.index===b.legs-1)pts.push(b.seg.b);
 if(!pts.some(p=>equal(p,end.source.at)||equal(p,end.target.at)))continue;
 for(const id of b.blocking){
 const pad=l.pads.find(p=>p.id===id);if(!pad){nonPad++;continue;}
 if(pad.net===row.netId)throw Error('Same-net pad cannot establish this obstruction');
 const shapes=padShapesOn(l,pad,b.sheet);
 if(!shapes.length)throw Error('Recorded pad absent on sheet');
 // padShapesOn returns convex parts. Refuse silently flattening a new composite form.
 const subject=coreOf({kind:'capsule',a:b.seg.a,b:b.seg.b,r:b.width/2});
 const metrics=shapes.map((s:Shape)=>{if(s.kind==='pieces')throw Error('Unexpected composite');
 const c=coreOf(s),d2=dist2Pts(subject.pts,c.pts),r=subject.r+c.r;
 const required=l.spacing.get(l.netGroups.find(g=>g.id===l.nets.find(n=>n.id===row.netId)?.group)!.categoryKinds.track,pad.kind,b.sheet);
 return {core_distance_squared:d2,radius_sum:r,required,overlaps:d2<=r*r,below_rule:d2<(r+required)**2};});
 records.push({case:row.case,key:row.key,trial:t.id,variant,segment:b,blocker:pad,part:l.parts.find(p=>p.id===pad.part)?.ref,shapes,metrics,luPerUm:l.frame.luPerUm});
 }
 }}
}
const summary=rows.map(row=>{const own=records.filter(r=>r.case===row.case&&r.key===row.key);return {case:row.case,key:row.key,pad_observations:own.length,overlap:own.filter(r=>r.metrics.some(m=>m.overlaps)).length,below_rule:own.filter(r=>r.metrics.some(m=>m.below_rule)).length};});
const selected=records.filter(r=>r.case==='paperino-hw-paperino-shield-j4'&&r.key==='4:10:62'&&r.trial===3);
if(selected.length!==6||!selected.every(r=>r.metrics.some(m=>m.below_rule)))throw Error('Selected original-pad rejection changed');
writeFileSync(out,JSON.stringify({scope:'Original static pad geometry only; other blockers require live trial snapshots. Repeated observations are not independent routes. No path feasibility or native DRC claim.',non_pad_observations:nonPad,summary,selected},null,2)+'\n');
console.log(JSON.stringify({pad_observations:records.length,non_pad_observations:nonPad,overlap:records.filter(r=>r.metrics.some(m=>m.overlaps)).length,below_rule:records.filter(r=>r.metrics.some(m=>m.below_rule)).length}));
