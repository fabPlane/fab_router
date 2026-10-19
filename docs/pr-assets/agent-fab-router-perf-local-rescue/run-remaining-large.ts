/** Engine-only fixed two-pass large-input comparison, three repeats each.
 * Explicit research adapter only; native DRC and default acceptance remain separate.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {routeDsn as normal} from '../../../src/api.ts';
import {routeDsn as candidate} from './candidate/src/api.ts';
const [out,...inputs]=process.argv.slice(2);if(!out||!inputs.length||existsSync(out))throw Error('Expected UNUSED_OUTPUT DSN...');
const rows=[];
for(const file of inputs)for(const mode of ['normal','candidate'])for(let repeat=0;repeat<3;repeat++){
 const input=readFileSync(file,'utf8'),settings={maxPasses:2,optimizerEnabled:false,fanoutEnabled:false,seed:1,timeBudgetMs:120000,strictDrc:true,neckWidthUm:0};
 const start=performance.now(),result=(mode==='normal'?normal:candidate)(input,settings),seconds=(performance.now()-start)/1000;
 if(!result.ok)throw Error('parse');
 const row={file,mode,repeat,settings,inputSha256:createHash('sha256').update(input).digest('hex'),seconds,report:result.report,stats:result.statsAfter,diagnostics:result.diagnostics,sesSha256:createHash('sha256').update(result.ses).digest('hex')};
 rows.push(row);console.log(JSON.stringify({file,mode,repeat,seconds,incomplete:row.report.incompleteAfter,addedViolations:row.report.violationsAdded,timedOut:row.report.timedOut}));
 writeFileSync(out,JSON.stringify({scope:'INCOMPLETE fixed-two-pass engine-only research comparison, no native DRC/full acceptance claim',rows},null,2)+'\n');
}
