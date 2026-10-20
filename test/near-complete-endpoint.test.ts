/** Real-board deletion fixture for the local recovery experiment. The default router currently
 * leaves 10→62 open. Pin legal progress and determinism, while allowing a future legal closure.
 * Removed pads are a diagnostic intervention, not proof of physical route feasibility.
 */
import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,checkDrc,writeSes} from '../src/api.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {legaliseTrail} from '../src/route/legalise.ts';
import {resolveProfile} from '../src/route/profile.ts';
import {ignoreOf} from '../src/route/clear.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import type {Pt} from '../src/geom/index.ts';
import type {RouteSettings} from '../spec/types/settings.ts';
import {scheduleRecovery} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/recovery-schedule.ts';
import {tryRecoveryTransaction} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/recovery-transaction.ts';
const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')) as {
 input_sha256:string;kept:number[];terminalIds:number[];settings:Partial<RouteSettings>;
};
const witness=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint-path.json',import.meta.url),'utf8')) as {net:number;sheet:number;raw:Pt[]};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('near-complete endpoint context preserves legal progress and deterministic retained copper',()=>{
 expect(sha(input)).toBe(fixture.input_sha256);
 const fingerprints=[];
 for(let repeat=0;repeat<3;repeat++){
  const read=readDsn(input);if(!read.ok)throw Error('Fixture parse failed');const l=read.layout;
  l.pads=l.pads.filter(p=>fixture.kept.includes(p.id));
  l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>fixture.kept.includes(id))}));
  const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1,target=4;
  l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
  l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
  const settings={...fixture.settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)};
  const retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels,pours:l.pours});
  expect(l.pads.filter(p=>p.net===target).map(p=>p.id)).toEqual(fixture.terminalIds);
  expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(2);
  expect(checkDrc(l).counts.violations).toBe(0);
  const report=route(l,settings),left=requiredConnections(l).filter(c=>c.net===target);
  expect(report.aborted||report.timedOut).toBe(false);
  expect(report.violationsAdded).toBe(0);
  expect(checkDrc(l).counts.violations).toBe(0);
  expect(left.length).toBeLessThanOrEqual(1);
  // The short 9→10 branch must stay joined even if the longer connection stalls.
  expect(left.every(c=>c.from===10&&c.to===62)).toBe(true);
  expect(JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.origin!=='router'),barrels:l.barrels.filter(b=>b.origin!=='router'),pours:l.pours})).toBe(retained);
  fingerprints.push(sha(writeSes(l)));
  // A recorded raw grid path proves this reduced context is physically routable under
  // the represented rules. Future routing may close it itself; neither failure is pinned.
  if(left.length){
   const lattice=buildLattice(l),journal=createJournal(l,lattice),mark=journal.mark();
   const profile=resolveProfile(l,witness.net,resolveSettings(settings,undefined,l.angleMode));
   const leg=legaliseTrail(l,lattice,witness.sheet,witness.raw,profile,ignoreOf(witness.net),false);
   expect(leg.ok).toBe(true);
   expect(leg.widths.every(w=>w===profile.width)).toBe(true);
   const session=writeSes(l);
   const targetPair={net:target,from:10,to:62};
   const addWitness=()=>journal.addTrack({net:witness.net,sheet:witness.sheet,pts:leg.pts,width:profile.width,kind:profile.trackKind,hold:'free'});
   const assertRestored=()=>{
    expect(writeSes(l)).toBe(session);
    expect(requiredConnections(l).filter(c=>c.net===target)).toEqual(left);
    expect(checkDrc(l).counts.violations).toBe(0);
    expect(legaliseTrail(l,lattice,witness.sheet,witness.raw,profile,ignoreOf(witness.net),false).ok).toBe(true);
    expect(journal.insertedSince(mark)).toEqual([]);
   };
   const scheduled=scheduleRecovery(l,lattice,journal,targetPair,{
    enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8],
    maxAttempts:3,maxExpansions:3,maxMilliseconds:1000,
   },trial=>{trial.expand();addWitness();});
   expect(scheduled.status).toBe('kept');
   expect(scheduled.trials[0]!.outcome).toBe('region');
   expect(scheduled.trials.at(-1)!.outcome).toBe('kept');
   expect(scheduled.expansions).toBe(scheduled.trials.length);
   expect(checkDrc(l).counts.violations).toBe(0);
   expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(0);
   journal.rewind(mark);assertRestored();
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{})).toBe('open');
   assertRestored();
   expect(()=>tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{addWitness();throw Error('proposal interrupted');})).toThrow('proposal interrupted');
   assertRestored();
   const blocker=l.pads.find(p=>p.net!==target&&p.sheets.includes(witness.sheet))!;
   expect(blocker).toBeDefined();
   let rejectedId=-1;
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{
    addWitness();
    rejectedId=journal.addTrack({net:target,sheet:witness.sheet,
     pts:[blocker.at,{x:blocker.at.x+profile.width,y:blocker.at.y}],
     width:profile.width,kind:profile.trackKind,hold:'free'}).id;
    expect(checkDrc(l).counts.violations).toBeGreaterThan(0);
   })).toBe('drc');
   expect(lattice.itemOf(rejectedId)).toBeUndefined();
   assertRestored();
   // A full-width legal closure can still leave the allowed local region.
   // All vertices fit this box; clipping half a unit of its end-cap does not.
   const region={x0:Math.min(...leg.pts.map(p=>p.x))-profile.width/2,
    x1:Math.max(...leg.pts.map(p=>p.x))+profile.width/2,
    y0:Math.min(...leg.pts.map(p=>p.y))-profile.width/2,
    y1:Math.max(...leg.pts.map(p=>p.y))+profile.width/2};
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{
    rejectedId=addWitness().id;
    expect(checkDrc(l).counts.violations).toBe(0);
    expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(0);
   },{...region,x0:region.x0+0.5})).toBe('region');
   expect(lattice.itemOf(rejectedId)).toBeUndefined();
   assertRestored();
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{addWitness();},region)).toBe('kept');
   expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(0);
   journal.rewind(mark);
   assertRestored();
   // Close the longer connection while ripping up the short branch: aggregate
   // incomplete count stays one, but a previously joined terminal pair is lost.
   const short=l.tracks.find(t=>t.origin==='router'&&t.net===target)!;
   expect(short).toBeDefined();
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{
    journal.remove(short.id);addWitness();
    expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(1);
   })).toBe('terminals');
   assertRestored();
   expect(tryRecoveryTransaction(l,lattice,journal,targetPair,()=>{addWitness();})).toBe('kept');
   expect(checkDrc(l).counts.violations).toBe(0);
   expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(0);
   journal.rewind(mark);
   expect(writeSes(l)).toBe(session);
   expect(requiredConnections(l).filter(c=>c.net===target)).toEqual(left);
   // Duplicate an already legal branch as retained copper. Removing this
   // redundant item does not split terminals or add DRC errors: ownership must
   // reject it independently, for every non-router origin.
   for(const origin of ['file','session','prior'] as const){
    const id=Math.max(...[l.pads,l.tracks,l.barrels,l.pours,l.fences].flatMap(items=>items.map(i=>i.id)))+1;
    const retainedBranch={...short,id,origin};
    l.tracks=[...l.tracks,retainedBranch];
    const ownLattice=buildLattice(l),ownJournal=createJournal(l,ownLattice);
    const ownSession=writeSes(l),ownMark=ownJournal.mark();
    expect(checkDrc(l).counts.violations).toBe(0);
    expect(tryRecoveryTransaction(l,ownLattice,ownJournal,targetPair,()=>{
     ownJournal.remove(id);
     ownJournal.addTrack({net:witness.net,sheet:witness.sheet,pts:leg.pts,width:profile.width,kind:profile.trackKind,hold:'free'});
     expect(checkDrc(l).counts.violations).toBe(0);
     expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(0);
    })).toBe('retained');
    expect(writeSes(l)).toBe(ownSession);
    expect(l.tracks.find(t=>t.id===id)).toEqual(retainedBranch);
    expect(ownLattice.itemOf(id)).toBeDefined();
    expect(ownJournal.insertedSince(ownMark)).toEqual([]);
    expect(requiredConnections(l).filter(c=>c.net===target)).toEqual(left);
    l.tracks=l.tracks.filter(t=>t.id!==id);
   }
  }
 }
 expect(fingerprints[0]).toBe(fingerprints[1]);
 expect(fingerprints[0]).toBe(fingerprints[2]);
},30_000);
