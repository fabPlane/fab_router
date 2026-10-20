/** Bounded paired ladder engine regression replay, not a native DRC score. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [source,input,out]=process.argv.slice(2);if(!source||!input||!out)throw Error('SOURCE INPUT UNUSED_OUTPUT');
const {routeDsn}=await import(pathToFileURL(resolve(source,'src/api.ts')).href);
const settings={maxPasses:2,timeBudgetMs:600000,optimizerEnabled:false,fanoutEnabled:false,strictDrc:true,neckWidthUm:0,localRecovery:true,seed:1};
const start=performance.now();const r=routeDsn(readFileSync(input,'utf8'),settings);const seconds=(performance.now()-start)/1000;
if(!r.ok)throw Error('parse');mkdirSync(out);writeFileSync(resolve(out,'board.ses'),r.ses);writeFileSync(resolve(out,'result.json'),JSON.stringify({scope:'ladder engine regression replay; no fresh native score',seconds,settings,report:r.report,stats:r.statsAfter},null,2)+'\n');
