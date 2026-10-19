/** One fresh process per unchanged timed acceptance case and source. */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,existsSync} from 'node:fs';
const [root,id,out]=process.argv.slice(2);if(!root||!id||!out||existsSync(out))throw Error('Expected SOURCE CASE UNUSED_OUTPUT');
const {loadCases}=await import(pathToFileURL(resolve(root,'tools/acceptance/cases.ts')).href);
const {runCase}=await import(pathToFileURL(resolve(root,'tools/acceptance/run-case.ts')).href);
const loaded=loadCases();if(loaded.invalid.length)throw Error('Invalid cases');
const c=loaded.cases.find((c:{id:string})=>c.id===id);if(!c)throw Error('Missing case');
const result=runCase({...c,settings:{...c.settings,localRecovery:true}});
writeFileSync(out,JSON.stringify({scope:'Fresh process, original case/expectations/budget, recovery enabled',source:root,case:c,result},null,2)+'\n');
console.log(JSON.stringify({id,pass:result.pass,ms:result.ms,measured:result.measured}));
