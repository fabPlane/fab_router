/** Offline attachment classification only; does not route or run clearance queries.
 * bun classify-trial-ends.ts NATIVE_ROOT TRIAL_RESULTS UNUSED_OUTPUT
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn} from '../../../src/api.ts';
import type {Pt} from '../../../src/geom/index.ts';
const [nativeRoot,input,output]=process.argv.slice(2);
if(!nativeRoot||!input||!output||existsSync(output))throw new Error('Expected NATIVE_ROOT TRIAL_RESULTS UNUSED_OUTPUT');
type Blocked={index:number;legs:number;seg:{a:Pt;b:Pt};blocking:number[]};
type Trial={kind:string;ok:boolean;blocked?:Blocked[]};
type Row={case:string;key:string;net:string;trials:Trial[]};
const rows=JSON.parse(readFileSync(input,'utf8')) as Row[];
const prior=JSON.parse(readFileSync(resolve(nativeRoot,'results.json'),'utf8')) as {case:string;seed:number;evidence:string}[];
const equal=(a:Pt,b:Pt)=>a.x===b.x&&a.y===b.y;
const result=rows.map(row=>{
 const run=prior.find(r=>r.case===row.case&&r.seed===1);
 if(!run)throw new Error('Missing native input');
 const dsn=readFileSync(resolve(nativeRoot,run.evidence,'work/board.dsn'),'utf8');
 const loaded=readDsn(dsn);if(!loaded.ok)throw new Error('Invalid DSN');
 const layout=loaded.layout;const [,from,to]=row.key.split(':').map(Number);
 const endpoint=(id:number|undefined)=>{
  const pad=layout.pads.find(p=>p.id===id);if(pad)return {kind:'pad',id:pad.id,at:pad.at};
  const barrel=layout.barrels.find(p=>p.id===id);if(barrel)return {kind:'barrel',id:barrel.id,at:barrel.at};
  throw new Error('Unsupported original endpoint; do not approximate pour attachment');
 };
 const source=endpoint(from),target=endpoint(to);
 const counts={original_endpoint_segment:0,other_trial_endpoint_segment:0,interior_segment:0};
 const originalBlockers:Record<string,number>={};
 for(const t of row.trials){
  if(t.kind!=='insertTrail'||t.ok)continue;
  for(const b of t.blocked??[]){
   const ends:Pt[]=[];
   if(b.index===0)ends.push(b.seg.a);
   if(b.index===b.legs-1)ends.push(b.seg.b);
   if(!ends.length){counts.interior_segment++;continue;}
   if(ends.some(p=>equal(p,source.at)||equal(p,target.at))){
    counts.original_endpoint_segment++;
    for(const id of b.blocking)originalBlockers[String(id)]=(originalBlockers[String(id)]??0)+1;
   }else counts.other_trial_endpoint_segment++;
  }
 }
 return {case:row.case,key:row.key,net:row.net,input_sha256:createHash('sha256').update(dsn).digest('hex'),source,target,counts,
  original_endpoint_blocker_ids:originalBlockers};
});
writeFileSync(output,JSON.stringify({scope:'Offline first-blocked variant classification; original endpoints are pads/barrels only; other endpoints are not proven via sites',rows:result},null,2)+'\n');
console.log('Classified '+result.length+' residual keys without routing or geometry queries');
