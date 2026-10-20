import {test,expect,spyOn} from 'bun:test';
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

test('research adapter forwards an already-aborted signal to normal routing',()=>{
 const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
 const settings=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')).settings;
 const controller=new AbortController();controller.abort();
 const before=normal(input,settings,{signal:controller.signal}),after=candidate(input,settings,{signal:controller.signal});
 if(!before.ok||!after.ok)throw Error('parse');
 expect(after.report.aborted).toBe(true);expect(after.report.stoppedBy).toBe('abort');
 expect(after.ses).toBe(before.ses);expect(after.report.added).toEqual(before.report.added);
 expect(JSON.parse(after.diagnostics.find(d=>d.code==='research-local-recovery')!.message).status).toBe('normal-budget-stop');
},120000);


test('research adapter spends only the remaining route-wide monotonic budget',()=>{
 const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
 const settings=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')).settings;
 let now=0,passes=0;
 const timer=spyOn(performance,'now').mockImplementation(()=>now);
 try {
  const before=normal(input,{...settings,timeBudgetMs:120000});
  const after=candidate(input,{...settings,timeBudgetMs:120000},{onPass(){passes++;now=120000;}});
  if(!before.ok||!after.ok)throw Error('parse');
  expect(passes).toBeGreaterThan(0);expect(before.report.timedOut).toBe(false);
  expect(after.report.timedOut).toBe(true);expect(after.report.stoppedBy).toBe('timeBudget');
  expect(after.ses).toBe(before.ses);expect(after.report.incompleteAfter).toBe(6);
  expect(after.report.added).toEqual(before.report.added);
  const recovery=JSON.parse(after.diagnostics.find(d=>d.code==='research-local-recovery')!.message);
  expect(recovery.status).toBe('deadline');expect(recovery.targets).toEqual([]);
 }finally{timer.mockRestore();}
},120000);
