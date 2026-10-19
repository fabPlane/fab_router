/** Three paired repeats per larger input with identical fixed two-pass budgets. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [before,after,out,...inputs]=process.argv.slice(2);
if(!before||!after||!out||!inputs.length||existsSync(out))throw Error('Expected BEFORE_ROOT AFTER_ROOT UNUSED_OUTPUT DSN...');
const rows=[];
for(const file of inputs)for(let repeat=1;repeat<=3;repeat++)for(const [mode,root] of (repeat%2?[['before',before],['after',after]]:[['after',after],['before',before]])){
 const {routeDsn}=await import(pathToFileURL(resolve(root!,'src/api.ts')).href);
 const input=readFileSync(file,'utf8'),settings={localRecovery:true,maxPasses:2,optimizerEnabled:false,fanoutEnabled:false,seed:1,timeBudgetMs:600000,strictDrc:true,neckWidthUm:0};
 const start=performance.now(),result=routeDsn(input,settings),seconds=(performance.now()-start)/1000;
 if(!result.ok)throw Error('Parse');
 const row={file,mode,repeat,settings,inputSha256:createHash('sha256').update(input).digest('hex'),seconds,report:result.report,stats:result.statsAfter,diagnostics:result.diagnostics,sesSha256:createHash('sha256').update(result.ses).digest('hex')};
 rows.push(row);writeFileSync(out,JSON.stringify({scope:'Original-point vs bounded alternate-point recovery; three paired repeats/input; engine-only, no native DRC claim',rows},null,2)+'\n');
 console.log(JSON.stringify({file,mode,repeat,seconds,incomplete:row.report.incompleteAfter,addedViolations:row.report.violationsAdded,timedOut:row.report.timedOut}));
}
