import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [baseline, candidate, inputs, output] = process.argv.slice(2);
if (!baseline || !candidate || !inputs || !output) throw new Error('Expected BASELINE_SOURCE CANDIDATE_SOURCE INPUT_DIRECTORY OUTPUT_JSON');
const {routeDsn: before} = await import(pathToFileURL(resolve(baseline, 'src/api.ts')).href);
const {routeDsn: after} = await import(pathToFileURL(resolve(candidate, 'src/api.ts')).href);
const rows=[];
for(const file of ['l1.dsn','l2.dsn']) {
 const text=readFileSync(resolve(inputs, file),'utf8');
 for(let repeat=1;repeat<=3;repeat++) for(const [version,fn] of (repeat%2 ? [['before',before],['after',after]] : [['after',after],['before',before]]) as const) {
  const start=performance.now();const r=fn(text,{timeBudgetMs:600000,maxPasses:2,seed:1});
  if(!r.ok) throw new Error(JSON.stringify(r));
  const row={file,repeat,version,seconds:(performance.now()-start)/1000,ses_sha256:createHash('sha256').update(r.ses).digest('hex'),report:r.report};
  rows.push(row);console.log(file,repeat,version,row.seconds,r.report.incompleteAfter,r.report.timedOut);writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
 }
}
