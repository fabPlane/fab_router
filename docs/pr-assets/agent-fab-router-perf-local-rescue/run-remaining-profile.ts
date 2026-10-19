/** Profile a real normal stall once, then replay only the new post-pass 20 times.
 * Each replay starts with identical normal copper, no recorded route input.
 * Fresh helper Journal/lattice per replay; restoration happens between calls.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,writeSes,requiredConnections,checkDrc} from '../../../src/api.ts';
import {recoverRemaining} from './recover-remaining.ts';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected UNUSED_OUTPUT');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8'));
if(hash(input)!==fixture.input_sha256)throw Error('Changed fixture');
const parsed=readDsn(input);if(!parsed.ok)throw Error('parse');const l=parsed.layout;
const began=performance.now(),normal=route(l,fixture.settings),normalSeconds=(performance.now()-began)/1000;
if(normal.timedOut||normal.aborted||normal.incompleteAfter!==6||checkDrc(l).counts.violations)throw Error('Changed normal control');
const ses=writeSes(l),tracks=structuredClone(l.tracks),barrels=structuredClone(l.barrels),rows=[];
let expected:string|undefined;
for(let repeat=0;repeat<20;repeat++){
 const start=performance.now(),result=recoverRemaining(l,normal.effectiveSettings,true,16,true),seconds=(performance.now()-start)/1000;
 const after=writeSes(l);
 if(requiredConnections(l).length!==4||checkDrc(l).counts.violations)throw Error('Changed recovery');
 expected??=after;if(after!==expected)throw Error('Nondeterministic replay');
 rows.push({repeat,seconds,afterSha256:hash(after),result});
 // The known insertion-only helper has returned; no live Journal escapes it.
 l.tracks=structuredClone(tracks);l.barrels=structuredClone(barrels);
 if(writeSes(l)!==ses)throw Error('Restoration');
 console.log(JSON.stringify({repeat,seconds}));
}
writeFileSync(out,JSON.stringify({scope:'Engine-only CPU profiling; one normal route then twenty identical-state post-pass replays; not twenty independent full routes or native checks',normalSeconds,beforeSha256:hash(ses),rows},null,2)+'\n');
