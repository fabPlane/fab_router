import {test,expect} from 'bun:test';
import {emptyLayout,makeSpacingTable} from '../src/layout/index.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {resolveProfile} from '../src/route/profile.ts';
import {checkDrc,requiredConnections,writeSes} from '../src/api.ts';
import {scheduleRecovery} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/recovery-schedule.ts';
import {proposeVisibility} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/visibility-recovery.ts';
function fixture(){
 const l=emptyLayout('visibility');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[{id:0,name:'top',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:100}]]])}];
 l.pads=[{x:0,y:0},{x:10000,y:0},{x:5000,y:0}].map((at,id)=>({id,part:0,pinName:String(id),net:id===2?1:0,form:0,at,rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const}));
 l.nets=[{id:0,name:'target',group:0,pads:[0,1]},{id:1,name:'obstacle',group:0,pads:[2]}];
 const lattice=buildLattice(l),journal=createJournal(l,lattice),profile=resolveProfile(l,0,resolveSettings({},undefined,l.angleMode));
 return {l,lattice,journal,profile};
}
const target={net:0,from:0,to:1},plan={enabled:true,pitch:3000,margins:[0,2],maxAttempts:2,maxExpansions:1000,maxMilliseconds:10000};
test('visibility search discovers legal obstacle detour only after local region growth',()=>{
 const fingerprints=[];
 for(let repeat=0;repeat<3;repeat++){
  const {l,lattice,journal,profile}=fixture(),before=writeSes(l),mark=journal.mark();
  const outcomes:ReturnType<typeof proposeVisibility>[]=[];
  const result=scheduleRecovery(l,lattice,journal,target,plan,t=>{outcomes.push(proposeVisibility(l,lattice,journal,target,profile,t));});
  expect(result.status).toBe('kept');expect(result.trials.map(t=>t.outcome)).toEqual(['open','kept']);
  expect(outcomes.map(o=>o.found)).toEqual([false,true]);
  expect(result.expansions).toBeGreaterThan(outcomes.reduce((n,o)=>n+o.edges,0));
  expect(checkDrc(l).counts.violations).toBe(0);expect(requiredConnections(l)).toHaveLength(0);
  expect(l.tracks[0]!.pts.some(p=>p.y!==0)).toBe(true);fingerprints.push(writeSes(l));
  journal.rewind(mark);expect(writeSes(l)).toBe(before);expect(journal.insertedSince(mark)).toEqual([]);
 }
 expect(new Set(fingerprints).size).toBe(1);
});
test('visibility budget exhaustion and bounded graph miss preserve session and live index',()=>{
 const {l,lattice,journal,profile}=fixture(),before=writeSes(l);
 const result=scheduleRecovery(l,lattice,journal,target,{...plan,maxExpansions:10},t=>{proposeVisibility(l,lattice,journal,target,profile,t);});
 expect(result.status).toBe('budget');expect(result.expansions).toBe(10);expect(writeSes(l)).toBe(before);
 expect(journal.insertedSince(0)).toEqual([]);expect(lattice.itemOf(3)).toBeUndefined();
 const miss=scheduleRecovery(l,lattice,journal,target,plan,t=>{proposeVisibility(l,lattice,journal,target,profile,t,2);});
 expect(miss.status).toBe('exhausted');expect(writeSes(l)).toBe(before);
 expect(checkDrc(l).counts.violations).toBe(0);expect(requiredConnections(l)).toHaveLength(1);
 expect(()=>proposeVisibility(l,lattice,journal,target,profile,{region:{x0:0,y0:0,x1:1,y1:1},expand(){}},513)).toThrow('node cap');
});

test('visibility search discovers an original-context stall closure without a recorded path',async()=>{
 const {readFileSync}=await import('node:fs');
 const {readDsn,route}=await import('../src/api.ts');
 const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
 const f=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8'));
 const fingerprints=[];
 for(let repeat=0;repeat<3;repeat++){
  const parsed=readDsn(input);if(!parsed.ok)throw Error('parse');const l=parsed.layout,net=4;
  // Preserve all 60 pads as obstacles; route only this diagnostic target net.
  const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1;
  l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===net)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==net)}))];
  l.nets=l.nets.map(n=>n.id===net?n:{...n,group:n.group+offset});
  const settings=resolveSettings({...f.settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)},undefined,l.angleMode);
  const retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels,pours:l.pours});
  const report=route(l,settings);expect(report.aborted||report.timedOut).toBe(false);
  const before=requiredConnections(l).filter(c=>c.net===net);expect(before.map(c=>[c.from,c.to])).toEqual([[10,62]]);
  const ses=writeSes(l),lattice=buildLattice(l),journal=createJournal(l,lattice),mark=journal.mark(),profile=resolveProfile(l,net,settings);
  const result=scheduleRecovery(l,lattice,journal,before[0]!,{
   enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000,
  },t=>{proposeVisibility(l,lattice,journal,before[0]!,profile,t);});
  expect(result.status).toBe('kept');expect(checkDrc(l).counts.violations).toBe(0);
  expect(requiredConnections(l).filter(c=>c.net===net)).toHaveLength(0);
  expect(JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.origin!=='router'),barrels:l.barrels.filter(b=>b.origin!=='router'),pours:l.pours})).toBe(retained);
  fingerprints.push(writeSes(l));journal.rewind(mark);expect(writeSes(l)).toBe(ses);
  expect(journal.insertedSince(mark)).toEqual([]);expect(requiredConnections(l).filter(c=>c.net===net)).toEqual(before);
 }
 expect(new Set(fingerprints).size).toBe(1);
},120000);
