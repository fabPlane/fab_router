/** Three actual public API pairs for the connection illustration. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,writeSes,checkDrc} from '../../../src/api.ts';
import {padBoundsOn} from '../../../src/lattice/index.ts';
import type {RouteSettings} from '../../../spec/types/settings.ts';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected unused output');
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const settings=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')).settings as Partial<RouteSettings>;
const reference=JSON.parse(readFileSync(new URL('./remaining-checks/whole-board-copper-final.json',import.meta.url),'utf8')).rows[0];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),rows=[];
for(let repeat=0;repeat<3;repeat++){
 const b=readDsn(input),a=readDsn(input);if(!b.ok||!a.ok)throw Error('parse');
 const start=performance.now(),beforeReport=route(b.layout,settings),normalSeconds=(performance.now()-start)/1000;
 const targets:typeof reference.results.targets=[];
 const began=performance.now(),afterReport=route(a.layout,{...settings,localRecovery:true},{onLog:(_level,message)=>{if(message.startsWith('local-recovery result '))targets.push(JSON.parse(message.slice('local-recovery result '.length)));}}),candidateSeconds=(performance.now()-began)/1000;
 const beforeSes=writeSes(b.layout),afterSes=writeSes(a.layout);
 if(beforeSes!==reference.beforeSes||afterSes!==reference.afterSes)throw Error('Public sessions differ from native-checked research fixture');
 if(checkDrc(a.layout).counts.violations||beforeReport.incompleteAfter!==6||afterReport.incompleteAfter!==4)throw Error('Changed quality');
 rows.push({repeat,luPerUm:a.layout.frame.luPerUm,normalSeconds,candidateSeconds,beforeReport,afterReport,before:requiredConnections(b.layout),after:requiredConnections(a.layout),beforeTracks:b.layout.tracks,tracks:a.layout.tracks,beforeSha256:hash(beforeSes),afterSha256:hash(afterSes),results:{targets},pads:a.layout.pads.map(p=>({id:p.id,net:p.net,at:p.at,boundsBySheet:a.layout.stack.map(sheet=>({sheet:sheet.id,bounds:padBoundsOn(a.layout,p,sheet.id)}))}))});
 console.log(JSON.stringify({repeat,normalSeconds,candidateSeconds,before:6,after:4,exactErrors:0}));
 writeFileSync(out,JSON.stringify({scope:'Actual public API capture; sessions match previously native-checked fixture in every repeat',rows},null,2)+'\n');
}
