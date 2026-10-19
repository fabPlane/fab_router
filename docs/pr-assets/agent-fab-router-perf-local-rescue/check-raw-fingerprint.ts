/** Diagnose a changed fingerprint without changing its regression expectation. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [source,output]=process.argv.slice(2);if(!source||!output||existsSync(output))throw Error('Expected SOURCE UNUSED_OUTPUT');
const {routeDsn}=await import(`${source}/src/api.ts`);
const text=readFileSync(new URL('../../../spec/acceptance/boards/Issue026-J2_reference.dsn',import.meta.url),'utf8');
const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const start=performance.now(),r=routeDsn(text,{maxPasses:100,timeoutSeconds:120});if(!r.ok)throw Error('route failed');
 const rep=r.report;if(rep.timedOut||rep.aborted)throw Error('truncated');
 const head=[rep.incompleteAfter,rep.violationsAdded,rep.added.tracks,rep.added.barrels,rep.passes,rep.stoppedBy].join('|');
 rows.push({repeat,seconds:(performance.now()-start)/1000,fingerprint:createHash('sha256').update(head).update('\n').update(r.ses).digest('hex'),report:rep,statsAfter:r.statsAfter,session_sha256:createHash('sha256').update(r.ses).digest('hex')});
}
writeFileSync(output,JSON.stringify({input_sha256:createHash('sha256').update(text).digest('hex'),settings:{maxPasses:100,timeoutSeconds:120},rows},null,2)+'\n',{flag:'wx'});
