import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {route,readDsn,applySes,requiredConnections,checkDrc,writeSes} from '../src/api.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {connectivity} from '../src/drc/connect.ts';
import {createJournal} from '../src/route/journal.ts';
import {resolveProfile} from '../src/route/profile.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {scheduleRecovery} from '../src/route/recovery-schedule.ts';
import {proposeVisibility} from '../src/route/visibility-recovery.ts';
import {recoverRemaining} from '../src/route/recover-remaining.ts';

const fixture=JSON.parse(readFileSync(new URL('./data/component-anchor-stall.json',import.meta.url),'utf8'));
const dsn=readFileSync(new URL('./data/component-anchor-stall.dsn',import.meta.url),'utf8');
const ses=readFileSync(new URL('./data/component-anchor-stall.ses',import.meta.url),'utf8');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function layout(){
 expect(hash(dsn)).toBe(fixture.dsnSha256);expect(hash(ses)).toBe(fixture.sesSha256);
 const r=readDsn(dsn);if(!r.ok)throw Error('fixture parse');
 expect(applySes(r.layout,ses).ok).toBe(true);return r.layout;
}

test('alternate live component anchors close the original full-board stall without changing retained copper',()=>{
 const sessions=[];
 for(let repeat=0;repeat<3;repeat++){
  const l=layout(),lattice=buildLattice(l),journal=createJournal(l,lattice);
  const settings=resolveSettings(fixture.settings,undefined,l.angleMode),profile=resolveProfile(l,fixture.target.net,settings);
  const fixed=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]);
  const tracks=l.tracks.length,c=connectivity(l,lattice);
  expect(requiredConnections(l)).toEqual([fixture.target]);expect(checkDrc(l).counts.violations).toBe(0);
  expect(c.componentOf.get(fixture.target.from)).toBe(c.componentOf.get(fixture.anchor.from));
  expect(c.componentOf.get(fixture.target.to)).toBe(c.componentOf.get(fixture.anchor.to));
  const result=scheduleRecovery(l,lattice,journal,fixture.target,
   {enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000},
   trial=>{proposeVisibility(l,lattice,journal,fixture.anchor,profile,trial,512,true);},{},fixture.anchor);
  expect(result.status).toBe('kept');expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
  expect(l.tracks).toHaveLength(tracks+1);expect(l.tracks.at(-1)!.width).toBe(profile.width);
  expect(JSON.stringify([l.pads,l.pours,l.fences,l.tracks.slice(0,tracks),l.barrels])).toBe(fixed);
  sessions.push(writeSes(l));
 }
 expect(new Set(sessions).size).toBe(1);
});

test('public residual recovery closes through bounded alternate anchors',()=>{
 const l=layout(),before=writeSes(l),tracks=l.tracks.map(t=>JSON.stringify(t));
 const fixed=JSON.stringify([l.pads,l.pours,l.fences,l.barrels]);
 const result=recoverRemaining(l,resolveSettings(fixture.settings,undefined,l.angleMode),true,16,true);
 expect(result.targets[0]?.status).toBe('kept');
 expect(result.targets[0]?.pointRecovery?.work).toBe(18890);
 expect(result.targets[0]?.pointRecovery?.enumeration).toBe(124);
 expect(requiredConnections(l)).toEqual([]);
 expect(checkDrc(l).counts.violations).toBe(0);
 expect(JSON.stringify([l.pads,l.pours,l.fences,l.barrels])).toBe(fixed);
 for(const t of tracks)expect(l.tracks.some(v=>JSON.stringify(v)===t)).toBe(true);
 if(requiredConnections(l).length)expect(writeSes(l)).toBe(before);
 else expect(requiredConnections(l)).toEqual([]);
});


test('public alternate-anchor recovery shares item capacity and reports one original connection',()=>{
 const l=layout(),before=writeSes(l),tracks=l.tracks.length,barrels=l.barrels.length;
 const events:{ok:boolean;from:string;to:string}[]=[],logs:string[]=[];
 const result=route(l,{...fixture.settings,maxPasses:0,optimizerEnabled:false,fanoutEnabled:false,maxItems:1,localRecovery:true},
  {onConnection:event=>events.push(event),onLog:(_level,message)=>logs.push(message)});
 expect(result.incompleteBefore).toBe(1);expect(result.incompleteAfter).toBe(0);
 expect(result.stoppedBy).toBe('complete');expect(result.attempted).toBe(1);expect(result.completed).toBe(1);
 expect(result.added).toEqual({tracks:1,barrels:0});expect(l.tracks).toHaveLength(tracks+1);expect(l.barrels).toHaveLength(barrels);
 expect(writeSes(l)).not.toBe(before);expect(checkDrc(l).counts.violations).toBe(0);
 expect(events).toHaveLength(1);expect(events[0]).toMatchObject({ok:true,from:String(fixture.target.from),to:String(fixture.target.to)});
 const target=JSON.parse(logs.find(message=>message.startsWith('local-recovery result '))!.slice('local-recovery result '.length));
 expect(target.pointRecovery.enumeration).toBe(124);expect(target.pointRecovery.attempts).toHaveLength(2);
});

test('public alternate-anchor fixture respects opt-in, zero items, ignored nets, route deadline and hook cancellation',()=>{
 for(const mode of ['disabled','zero-items','ignored','deadline','hook-abort']as const){
  const l=layout(),before=writeSes(l),controller=new AbortController(),net=l.nets.find(n=>n.id===fixture.target.net)!;
  const settings={...fixture.settings,maxPasses:0,optimizerEnabled:false,fanoutEnabled:false};
  delete settings.localRecovery;
  if(mode!=='disabled')settings.localRecovery=true;
  if(mode==='zero-items')settings.maxItems=0;
  if(mode==='ignored')settings.ignoreNetGroups=[l.netGroups.find(g=>g.id===net.group)!.name];
  if(mode==='deadline')settings.timeBudgetMs=0;
  let events=0,attempts=0;
  const result=route(l,settings,{signal:controller.signal,onConnection:()=>events++,onLog:(_level,message)=>{
   if(message.startsWith('local-recovery attempt ')){attempts++;if(mode==='hook-abort')controller.abort();}
  }});
  expect(writeSes(l)).toBe(before);expect(requiredConnections(l)).toHaveLength(1);
  expect(checkDrc(l).counts.violations).toBe(0);expect(result.added).toEqual({tracks:0,barrels:0});expect(events).toBe(0);
  expect(attempts).toBe(mode==='hook-abort'?1:0);
  if(mode==='hook-abort'){expect(result.aborted).toBe(true);expect(result.stoppedBy).toBe('abort');}
  if(mode==='deadline'){expect(result.timedOut).toBe(true);expect(result.stoppedBy).toBe('timeBudget');}
 }
});
