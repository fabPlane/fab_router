/** Replay real onSeg calls: CORPUS_JSON OUTPUT_JSON; one warmup + six measured alternating pairs. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
const [input,output]=process.argv.slice(2);
if(!input || !output || existsSync(output)) throw new Error('Expected corpus and new output path');
const bytes=readFileSync(input);
const corpus=JSON.parse(bytes.toString()) as {samples:number[][]};
const samples=corpus.samples.map(([px,py,ax,ay,bx,by])=>({p:{x:px!,y:py!},a:{x:ax!,y:ay!},b:{x:bx!,y:by!}}));
type P={x:number,y:number};
function before(p:P,a:P,b:P) {
 if((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)!==0) return false;
 return Math.min(a.x,b.x)<=p.x&&p.x<=Math.max(a.x,b.x)&&Math.min(a.y,b.y)<=p.y&&p.y<=Math.max(a.y,b.y);
}
function after(p:P,a:P,b:P) {
 if(p.x<Math.min(a.x,b.x)||p.x>Math.max(a.x,b.x)||p.y<Math.min(a.y,b.y)||p.y>Math.max(a.y,b.y)) return false;
 return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)===0;
}
for(const {p,a,b} of samples) if(before(p,a,b)!==after(p,a,b)) throw new Error('Mismatch');
const started_utc=new Date().toISOString(),rows=[];
for(let repeat=0;repeat<=6;repeat++) for(const version of (repeat%2?['after','before']:['before','after'])) {
 const fn=version==='before'?before:after;let hits=0;
 const start=performance.now();
 for(let i=0;i<1000;i++) for(const {p,a,b} of samples) hits+=+fn(p,a,b);
 rows.push({repeat,version,seconds:(performance.now()-start)/1000,hits});
}
if(new Set(rows.map(r=>r.hits)).size!==1) throw new Error('Checksums differ');
writeFileSync(output,JSON.stringify({started_utc,finished_utc:new Date().toISOString(),bun:Bun.version,cpu:cpus()[0]?.model,corpus_sha256:createHash('sha256').update(bytes).digest('hex'),calls_per_row:samples.length*1000,rows},null,2)+'\n');
