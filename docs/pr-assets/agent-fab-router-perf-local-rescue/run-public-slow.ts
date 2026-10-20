/** Paired slow acceptance, same expectations; only opt-in setting differs. */
import {loadCases} from '../../../tools/acceptance/cases.ts';
import {runCase} from '../../../tools/acceptance/run-case.ts';
import {writeFileSync,existsSync} from 'node:fs';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected unused output');
const loaded=loadCases();if(loaded.invalid.length)throw Error('Invalid cases');
const rows=[];
for(const c of loaded.cases.filter(c=>c.tier==='slow'))for(const mode of ['normal','candidate']){
 const result=runCase(mode==='candidate'?{...c,settings:{...c.settings,localRecovery:true}}:c);
 rows.push({mode,result});console.log(JSON.stringify({mode,id:c.id,pass:result.pass,ms:result.ms,mismatches:result.mismatches}));
 writeFileSync(out,JSON.stringify({scope:'paired full slow acceptance; only localRecovery=true differs; expectations unchanged',rows},null,2)+'\n');
}
