/** SOURCE DSN [REPEATS]; fixed two-pass, seed 1 diagnostic profile. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,input,repeats='3']=process.argv.slice(2);
if(!source||!input)throw new Error('Expected SOURCE DSN [REPEATS]');
const {routeDsn}=await import(pathToFileURL(resolve(source,'src/api.ts')).href);
const text=readFileSync(input,'utf8');
const settings={timeBudgetMs:600000,maxPasses:2,seed:1};
for(let i=0;i<Number(repeats);i++) {
 const started_utc=new Date().toISOString();
 const start=performance.now(),r=routeDsn(text,settings);
 if(!r.ok)throw new Error(JSON.stringify(r));
 console.log(JSON.stringify({started_utc,finished_utc:new Date().toISOString(),distance_sha256:createHash("sha256").update(readFileSync(resolve(source,"src/geom/distance.ts"))).digest("hex"),seconds:(performance.now()-start)/1000,settings,input_sha256:createHash('sha256').update(text).digest('hex'),ses_sha256:createHash('sha256').update(r.ses).digest('hex'),report:r.report}));
}
