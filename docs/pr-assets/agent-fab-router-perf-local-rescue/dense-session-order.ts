/** Check whether capped dense sessions differ only under the existing session normalizer. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,run,output]=process.argv.slice(2);
if (!source || !run || !output || existsSync(output)) throw new Error('Expected SOURCE DENSE_RUN UNUSED_OUTPUT');
const {normaliseSession}=await import(pathToFileURL(resolve(source,'tools/acceptance/sexp.ts')).href);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const rows=JSON.parse(readFileSync(resolve(run,'results.json'),'utf8')).map((r:any)=>{
 const text=readFileSync(resolve(run,'runs',r.record.attempt,'fab-router/work/board.ses'),'utf8');
 const normalized=normaliseSession(text);
 if (!normalized) throw new Error('Session normalizer returned null');
 return {version:r.version,repeat:r.repeat,raw_sha256:hash(text),normalized_sha256:hash(JSON.stringify(normalized))};
});
writeFileSync(output,JSON.stringify({normalizer:'tools/acceptance/sexp.ts normaliseSession',rows,all_normalized_equal:new Set(rows.map((r:any)=>r.normalized_sha256)).size===1},null,2)+'\n');
