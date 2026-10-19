import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {routeDsn as normal} from '../src/api.ts';
import {routeDsn as candidate} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/candidate/src/api.ts';

test('explicit research adapter closes two real all-net stall links with retained exact quality',()=>{
 const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
 const settings=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')).settings;
 const before=normal(input,settings),after=candidate(input,settings);
 if(!before.ok||!after.ok)throw Error('parse');
 expect(before.report.incompleteAfter).toBe(6);expect(after.report.incompleteAfter).toBe(4);
 expect(after.report.violationsAdded).toBe(0);expect(after.statsAfter.violations.total).toBe(0);
 expect(after.report.added.tracks).toBe(before.report.added.tracks+2);
 expect(after.statsAfter.barrels).toEqual(before.statsAfter.barrels);
 const log=after.diagnostics.find(d=>d.code==='research-local-recovery');expect(log).toBeDefined();
 const recovery=JSON.parse(log!.message);expect(recovery.targets.filter((t:{status:string})=>t.status==='kept').map((t:{pair:{net:number}})=>t.pair.net)).toEqual([6,8]);
 expect(after.report.perNet.reduce((n,e)=>n+e.incomplete,0)).toBe(4);
},120000);
