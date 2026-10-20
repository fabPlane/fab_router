/** Profile one complete exported engine input; this is not a native benchmark run. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [source,work,out]=process.argv.slice(2);
if(!source||!work||!out||existsSync(out))throw Error('SOURCE_ROOT BENCHMARK_WORK UNUSED_OUTPUT');
const {routeDsn}=await import(pathToFileURL(resolve(source,'src/api.ts')).href);
const input=readFileSync(resolve(work,'board.dsn'),'utf8');
const settings=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8')).result.report.effectiveSettings;
settings.localRecovery=true;
const logs:string[]=[],start=performance.now();
const result=routeDsn(input,settings,{onLog:(_level:string,message:string)=>{if(message.startsWith('local-recovery'))logs.push(message);}});
if(!result.ok)throw Error('parse');
mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'board.ses'),result.ses);
writeFileSync(resolve(out,'result.json'),JSON.stringify({scope:'Single profiled production engine replay; no fresh native check or benchmark score',inputSha256:createHash('sha256').update(input).digest('hex'),settings,seconds:(performance.now()-start)/1000,sesSha256:createHash('sha256').update(result.ses).digest('hex'),report:result.report,stats:result.statsAfter,logs},null,2)+'\n');
