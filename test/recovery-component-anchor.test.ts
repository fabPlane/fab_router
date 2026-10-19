import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,applySes,requiredConnections,checkDrc,writeSes} from '../src/api.ts';
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

test('failed public residual recovery rewinds exactly; future legal closure remains permitted',()=>{
 const l=layout(),before=writeSes(l),tracks=l.tracks.map(t=>JSON.stringify(t));
 const fixed=JSON.stringify([l.pads,l.pours,l.fences,l.barrels]);
 recoverRemaining(l,resolveSettings(fixture.settings,undefined,l.angleMode),true,16,true);
 expect(checkDrc(l).counts.violations).toBe(0);
 expect(JSON.stringify([l.pads,l.pours,l.fences,l.barrels])).toBe(fixed);
 for(const t of tracks)expect(l.tracks.some(v=>JSON.stringify(v)===t)).toBe(true);
 if(requiredConnections(l).length)expect(writeSes(l)).toBe(before);
 else expect(requiredConnections(l)).toEqual([]);
});
