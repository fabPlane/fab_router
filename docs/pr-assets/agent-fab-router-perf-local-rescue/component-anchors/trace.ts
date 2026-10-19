/** Capture charged recovery trials on a fixed larger input, without changing budgets. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [out,file,...roots]=process.argv.slice(2);
if(!out||!file||roots.length!==2||existsSync(out))throw Error('Expected OUT INPUT BEFORE AFTER');
const rows=[];
for(let i=0;i<roots.length;i++){
 const {routeDsn}=await import(pathToFileURL(resolve(roots[i]!,'src/api.ts')).href);
 const logs:string[]=[],input=readFileSync(file,'utf8');
 const settings={localRecovery:true,maxPasses:2,optimizerEnabled:false,fanoutEnabled:false,seed:1,timeBudgetMs:600000,strictDrc:true,neckWidthUm:0};
 const start=performance.now(),r=routeDsn(input,settings,{onLog(_level:string,message:string){if(message.startsWith('local-recovery'))logs.push(message);}}),seconds=(performance.now()-start)/1000;
 if(!r.ok)throw Error('Parse');
 rows.push({mode:['before','after'][i],seconds,inputSha256:createHash('sha256').update(input).digest('hex'),settings,report:r.report,stats:r.statsAfter,sesSha256:createHash('sha256').update(r.ses).digest('hex'),logs});
 writeFileSync(out,JSON.stringify({rows},null,2)+'\n');
 console.log(JSON.stringify({mode:rows[i]!.mode,incomplete:r.report.incompleteAfter,seconds}));
}
