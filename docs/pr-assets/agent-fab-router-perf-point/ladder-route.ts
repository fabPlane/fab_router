/** Fixed-pass ladder comparison: BASELINE_SOURCE CANDIDATE_SOURCE INPUT_DIR OUTPUT_JSON. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [baseline, candidate, inputs, output] = process.argv.slice(2);
if (!baseline || !candidate || !inputs || !output) throw new Error('Expected BASELINE_SOURCE CANDIDATE_SOURCE INPUT_DIR OUTPUT_JSON');
if (existsSync(output)) throw new Error('Output already exists');
const {routeDsn: before} = await import(pathToFileURL(resolve(baseline, 'src/api.ts')).href);
const {routeDsn: after} = await import(pathToFileURL(resolve(candidate, 'src/api.ts')).href);
const rows = [];
const settings = {timeBudgetMs:600000, maxPasses:2, seed:1};
for (const file of ['l1.dsn', 'l2.dsn']) {
 const text = readFileSync(resolve(inputs,file),'utf8');
 const input_sha256 = createHash('sha256').update(text).digest('hex');
 for (let repeat=1;repeat<=3;repeat++) {
  for (const version of (repeat%2 ? ['before','after'] : ['after','before'])) {
   const route = version === 'before' ? before : after;
   const start = performance.now();
   const r = route(text,settings);
   if (!r.ok) throw new Error(JSON.stringify(r.error));
   const row = {file, repeat, version, input_sha256, settings,
    seconds:(performance.now()-start)/1000,
    ses_sha256:createHash('sha256').update(r.ses).digest('hex'),report:r.report};
   rows.push(row);
   writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
   console.log(file,repeat,version,row.seconds,r.report.incompleteAfter,r.report.violationsAdded);
  }
 }
}
for (const file of ['l1.dsn','l2.dsn']) {
 const cases = rows.filter(r=>r.file===file);
 if (new Set(cases.map(r=>r.ses_sha256)).size !== 1 || cases.some(r=>r.report.timedOut)) {
  throw new Error('Fixed-pass outputs differ or timed out: '+file);
 }
}
