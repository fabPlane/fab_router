/** Repeat S48 without changing its fixture, expectations, or 300-second budget.
 * Each invocation is one fresh-process sample. Alternate invocation order across pairs.
 */
import {loadCases} from '../../../tools/acceptance/cases.ts';
import {runCase} from '../../../tools/acceptance/run-case.ts';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const [mode,out]=process.argv.slice(2);
if ((mode!=='normal'&&mode!=='candidate') || !out || existsSync(out)) throw Error('Expected normal|candidate and unused output path');
const loaded=loadCases();
if(loaded.invalid.length)throw Error('Invalid acceptance cases');
const c=loaded.cases.find(c=>c.id==='routing-slow-issue555-cnh-strict');
if(!c || c.settings?.timeoutSeconds!==300 || c.settings?.strictDrc!==true)throw Error('Unexpected S48 settings');
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const paths=execFileSync('git',['ls-files','src','spec/types','tools/acceptance','spec/acceptance/cases/'+c.file],{encoding:'utf8'}).trim().split('\n');
const hashes=Object.fromEntries(paths.map(p=>[p,hash(p)]));
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const startedUtc=new Date().toISOString();
const settings=mode==='candidate'?{...c.settings,localRecovery:true}:c.settings;
const result=runCase({...c,settings});
for(const p of paths)if(hash(p)!==hashes[p])throw Error('Source changed during measurement: '+p);
const record={mode,startedUtc,finishedUtc:new Date().toISOString(),commit,
  bun:Bun.version,settings,case:c,sourceHashes:hashes,
  boardSha256:hash('spec/acceptance/boards/'+c.board),result};
writeFileSync(out,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({mode,...result}));
if(result.stub || !result.pass || result.measured.violationsAdded!==0)process.exitCode=1;
