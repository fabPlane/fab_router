import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [root,out,resume]=process.argv.slice(2);if(!root||!out||(existsSync(out)&&resume!=='--resume'))throw Error('ROOT OUTPUT [--resume]');
const {loadCases}=await import(pathToFileURL(resolve(root,'tools/acceptance/cases.ts')).href);
const {runCase}=await import(pathToFileURL(resolve(root,'tools/acceptance/run-case.ts')).href);
const loaded=loadCases();if(loaded.invalid.length)throw Error('invalid');
const cases=loaded.cases.filter((c:any)=>c.tier==='slow');
const prior=existsSync(out)?JSON.parse(readFileSync(out,'utf8')):undefined;
if(prior&&(prior.root!==resolve(root)||prior.rows.some((r:any,i:number)=>r.id!==cases[i]?.id)))throw Error('Resume source/case mismatch');
const rows:any[]=prior?.rows??[];
for(const c of cases.slice(rows.length)){console.log(JSON.stringify({starting:c.id}));const result=runCase({...c,settings:{...c.settings,localRecovery:true}});rows.push(result);writeFileSync(out,JSON.stringify({root:resolve(root),resumed:!!prior,scope:'Fresh enabled slow sweep; unchanged expectations; one evaluation/case',complete:rows.length===cases.length,total:cases.length,rows},null,2)+'\n');console.log(JSON.stringify({id:c.id,pass:result.pass,ms:result.ms,mismatches:result.mismatches}));}
