import {test,expect,spyOn} from 'bun:test';
import {readFileSync} from 'node:fs';
import {readDsn,applySes,writeSes,checkDrc,requiredConnections} from '../src/api.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import * as schedule from '../src/route/recovery-schedule.ts';
import * as visibility from '../src/route/visibility-recovery.ts';
import {recoverPointComponent} from '../src/route/recovery-point-component.ts';
const root=new URL('./data/',import.meta.url);
const fixture=JSON.parse(readFileSync(new URL('component-anchor-stall.json',root),'utf8'));
function setup(){
 const r=readDsn(readFileSync(new URL('component-anchor-stall.dsn',root),'utf8'));if(!r.ok)throw Error('parse');
 expect(applySes(r.layout,readFileSync(new URL('component-anchor-stall.ses',root),'utf8')).ok).toBe(true);
 const l=r.layout,settings=resolveSettings(fixture.settings,undefined,l.angleMode),before=writeSes(l);
 return {l,settings,before};
}
function unchanged(l:ReturnType<typeof setup>['l'],before:string){
 expect(writeSes(l)).toBe(before);expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
}
test('one target budget includes original work, enumeration and alternate; exact boundary succeeds',()=>{
 const {l,settings}=setup(),tracks=l.tracks.length,fixed=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]);
 const result=recoverPointComponent(l,settings,fixture.target,{}, {maxWork:18890});
 expect(result.status).toBe('kept');expect(result.work).toBe(18890);expect(result.enumeration).toBe(124);
 expect(result.attempts.map(a=>[a.anchor.from,a.anchor.to,a.result.status,a.result.expansions])).toEqual([[29,46,'exhausted',14509],[8,19,'kept',4257]]);
 expect(result.work).toBe(result.enumeration+result.attempts.reduce((n,a)=>n+a.result.expansions,0));
 expect(JSON.stringify([l.pads,l.pours,l.fences,l.tracks.slice(0,tracks),l.barrels])).toBe(fixed);
 expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
});
test('work exhaustion in original search, enumeration, and alternate never resets or leaks copper',()=>{
 for(const cap of [1,14509,14510,14632,14633,14634,18889]){
  const {l,settings,before}=setup();const result=recoverPointComponent(l,settings,fixture.target,{}, {maxWork:cap});
  expect(result.status).toBe('budget');expect(result.work).toBe(cap);
  expect(result.work).toBe(result.enumeration+result.attempts.reduce((n,a)=>n+a.result.expansions,0));
  expect(result.attempts.length).toBe(cap<=14633?1:2);unchanged(l,before);
 }
});
test('enumeration checks cancellation and both absolute deadlines before every charged item/pair',()=>{
 for(const kind of ['abort','local','route'] as const){
  const {l,settings,before}=setup(),controller=new AbortController();let phase=false,reads=0,now=0;
  const original=schedule.scheduleRecovery;
  const scheduler=spyOn(schedule,'scheduleRecovery').mockImplementation((...args)=>{const r=original(...args);phase=true;return r;});
  const timer=spyOn(performance,'now').mockImplementation(()=>{if(phase&&++reads===12){if(kind==='abort')controller.abort();else now=kind==='local'?15:10;}return now;});
  try{
   const result=recoverPointComponent(l,settings,fixture.target,{signal:controller.signal,...(kind==='route'?{deadline:10}:{})},{maxMilliseconds:15});
   expect(result.status).toBe(kind==='abort'?'aborted':kind==='local'?'budget':'deadline');
   expect(result.attempts).toHaveLength(1);expect(result.enumeration).toBeGreaterThan(0);expect(result.enumeration).toBeLessThan(124);
   expect(result.work).toBe(14509+result.enumeration);unchanged(l,before);
  }finally{scheduler.mockRestore();timer.mockRestore();}
 }
});
test('late or cancelled successful alternate insertion is rewound against original terminals',()=>{
 for(const kind of ['abort','local','route'] as const){
  const {l,settings,before}=setup(),controller=new AbortController();let now=0,inserted=false;
  const timer=spyOn(performance,'now').mockImplementation(()=>now),original=visibility.proposeVisibility;
  const run=schedule.scheduleRecovery;let calls=0;
  const scheduler=spyOn(schedule,'scheduleRecovery').mockImplementation((...args)=>{
   const r=run(...args);if(++calls===1&&kind==='local')now=10;return r;
  });
  const proposal=spyOn(visibility,'proposeVisibility').mockImplementation((...args)=>{
   const r=original(...args);
   if(r.found){inserted=true;if(kind==='abort')controller.abort();else now=kind==='local'?15:10;}
   return r;
  });
  try{
   const result=recoverPointComponent(l,settings,fixture.target,{signal:controller.signal,...(kind==='route'?{deadline:10}:{})},{maxMilliseconds:15});
   expect(inserted).toBe(true);expect(result.attempts).toHaveLength(2);
   expect(result.status).toBe(kind==='abort'?'aborted':kind==='local'?'budget':'deadline');unchanged(l,before);
  }finally{proposal.mockRestore();scheduler.mockRestore();timer.mockRestore();}
 }
});
test('zero item allowance and entry stop perform no proposal work',()=>{
 const {l,settings,before}=setup(),controller=new AbortController();controller.abort();
 for(const [control,options,status] of [[{signal:controller.signal},{},'aborted'],[{deadline:0},{},'deadline'],[{}, {maxItems:0},'items']] as const){
  const result=recoverPointComponent(l,settings,fixture.target,control,options);
  expect(result.status).toBe(status);expect(result.work).toBe(0);expect(result.attempts).toEqual([]);unchanged(l,before);
 }
});
test('ordinary successful point search retains charged trace without enumeration',()=>{
 const {l,settings}=setup();
 const result=recoverPointComponent(l,settings,fixture.anchor);
 expect(result.status).toBe('kept');expect(result.enumeration).toBe(0);expect(result.attempts).toHaveLength(1);
 expect(result.work).toBe(4257);expect(result.attempts[0]!.result.trials.map(t=>[t.margin,t.outcome])).toEqual([[0,'open'],[4,'open'],[8,'kept']]);
 expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
});
test('exhausting all eight alternate pairs retains one ledger and leaves the original session',()=>{
 const {l,settings,before}=setup();
 const proposal=spyOn(visibility,'proposeVisibility').mockImplementation((_l,_i,_j,_t,_p,trial)=>{
  trial.expand();return {found:false,nodes:0,edges:0};
 });
 try{
  const result=recoverPointComponent(l,settings,fixture.target);
  expect(result.status).toBe('exhausted');expect(result.attempts).toHaveLength(9);
  expect(result.enumeration).toBe(124);expect(result.work).toBe(124+9*4);
  expect(new Set(result.attempts.map(a=>`${a.anchor.from},${a.anchor.to}`)).size).toBe(9);
  expect(result.attempts.slice(1).every(a=>a.anchor.net===fixture.target.net&&a.result.expansions===4&&a.result.trials.length===4)).toBe(true);
  expect(result.attempts[1]!.anchor).toMatchObject({from:8,to:19,net:3});unchanged(l,before);
 }finally{proposal.mockRestore();}
});
test('limits reject invalid configurations before mutation',()=>{
 const {l,settings,before}=setup();
 for(const options of [{maxWork:0},{maxWork:1.5},{maxWork:100001},{maxMilliseconds:0},{maxMilliseconds:NaN},{maxMilliseconds:15001},{maxPairs:0},{maxPairs:9},{maxItems:2}]){
  expect(()=>recoverPointComponent(l,settings,fixture.target,{},options)).toThrow('Invalid point recovery limits');unchanged(l,before);
 }
});
