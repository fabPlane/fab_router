/** One bounded large-input run per process: SOURCE off|on INPUT OUTPUT. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,enabled,input,output]=process.argv.slice(2);
if (!source || !['off','on'].includes(enabled!) || !input || !output || existsSync(output)) throw new Error('Expected SOURCE off|on INPUT UNUSED_OUTPUT');
const {routeDsn}=await import(pathToFileURL(resolve(source,'src/api.ts')).href);
const text=readFileSync(input,'utf8');
const settings={timeBudgetMs:120000,maxPasses:2,seed:1,...(enabled==='on'?{localRescue:true}:{})};
const logs:string[]=[];
const started_utc=new Date().toISOString(), start=performance.now();
const result=routeDsn(text,settings,{onLog:(_:unknown,s:string)=>logs.push(s)});
if (!result.ok) throw new Error(JSON.stringify(result.error));
writeFileSync(output,JSON.stringify({source,enabled,input,input_sha256:createHash('sha256').update(text).digest('hex'),settings,started_utc,finished_utc:new Date().toISOString(),seconds:(performance.now()-start)/1000,report:result.report,statsBefore:result.statsBefore,statsAfter:result.statsAfter,logs,ses_sha256:createHash('sha256').update(result.ses).digest('hex')},null,2)+'\n');
writeFileSync(output+'.ses',result.ses);
console.log(result.report.incompleteAfter,result.report.violationsAdded);
