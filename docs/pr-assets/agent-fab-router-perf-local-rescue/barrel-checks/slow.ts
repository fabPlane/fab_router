/** Complete unchanged slow acceptance with public localRecovery enabled. */
import {loadCases} from '../../../../tools/acceptance/cases.ts';
import {runCase} from '../../../../tools/acceptance/run-case.ts';
import {writeFileSync,existsSync} from 'node:fs';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected unused output');
const loaded=loadCases();if(loaded.invalid.length)throw Error('Invalid cases');
const cases=loaded.cases.filter(c=>c.tier==='slow'),rows=[];
for(const c of cases){
 const result=runCase({...c,settings:{...c.settings,localRecovery:true}});
 rows.push(result);writeFileSync(out,JSON.stringify({scope:'Current barrel-capable recovery enabled; unchanged slow expectations; one evaluation per case',complete:rows.length===cases.length,total:cases.length,rows},null,2)+'\n');
 console.log(JSON.stringify({id:c.id,pass:result.pass,ms:result.ms,mismatches:result.mismatches}));
}
