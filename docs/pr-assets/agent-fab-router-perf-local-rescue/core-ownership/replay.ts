// SPDX-License-Identifier: GPL-3.0-only
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,input,out]=process.argv.slice(2);
const {routeDsn}=await import(pathToFileURL(resolve(source!,'src/api.ts')).href);
const settings=JSON.parse(readFileSync(resolve(input!,'router-summary.json'),'utf8')).settings;
if(settings.localRecovery===true)throw Error('requires recovery disabled');
const started=performance.now();
const result=routeDsn(readFileSync(resolve(input!,'board.dsn'),'utf8'),settings);
const seconds=(performance.now()-started)/1000;
if(!result.ok)throw Error('parse failure');
mkdirSync(out!);writeFileSync(resolve(out!,'router-summary.json'),JSON.stringify({settings,result},null,2)+'\n');
writeFileSync(resolve(out!,'board.ses'),result.ses);
writeFileSync(resolve(out!,'timing.json'),JSON.stringify({seconds,scope:'engine replay; no native checks'})+'\n');

const {ownershipCensus,ownershipTotals}=await import(pathToFileURL(resolve(source!,'src/geom/distance.ts')).href);
writeFileSync(resolve(out!,'census.json'),JSON.stringify({rows:ownershipCensus,totals:ownershipTotals},null,2)+'\n');
