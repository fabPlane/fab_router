import {expect,test} from 'bun:test';
import {synthLayout} from './helpers/synth.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {connectivity,incompleteCount} from '../src/drc/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {runOptimise} from '../src/route/optimise.ts';
import {DEFAULT_ROUTE_SETTINGS} from '../spec/types/settings.ts';
import type {Layout,Barrel} from '../spec/types/layout.ts';

function fixture(redundant=false): Layout {
 const barrel:Barrel={id:100,net:1,at:{x:0,y:0},form:4,fromSheet:0,toSheet:3,kind:1,hold:'free',origin:'router'};
 return {...synthLayout({parts:0,tracks:0,barrels:0}),pads:[],pours:[],fences:[],
  barrels:redundant?[barrel,{...barrel,id:101}]:[barrel],
  tracks:[0,3].map((sheet,i)=>({id:200+i,net:1,sheet,pts:[{x:0,y:0},{x:20000,y:0}],width:2000,kind:1,hold:'free' as const,origin:'router' as const}))};
}
for(const ignored of [new Set<number>(),new Set([1])]){
 test(`retain barrel joining two nonterminal fragments (ignored=${ignored.has(1)})`,()=>{
  const layout=fixture();const lattice=buildLattice(layout);const journal=createJournal(layout,lattice);
  const before=connectivity(layout,lattice);const stats=journal.stats();const mark=journal.mark();
  expect(incompleteCount(before,1)).toBe(0);
  const result=runOptimise(layout,lattice,journal,{...DEFAULT_ROUTE_SETTINGS,optimizerEnabled:true},ignored);
  expect(result.barrelsRemoved).toBe(0);expect(layout.barrels.map(b=>b.id)).toEqual([100]);
  expect(connectivity(layout,lattice).nets).toEqual(before.nets);
  expect(connectivity(layout,lattice).nets).toEqual(connectivity(layout,buildLattice(layout)).nets);
  expect(journal.stats()).toEqual(stats);expect(journal.mark()).toBe(mark);
 });
}
test('remove redundant barrel but retain the remaining bridge',()=>{
 const layout=fixture(true);const lattice=buildLattice(layout);const journal=createJournal(layout,lattice);
 const result=runOptimise(layout,lattice,journal,{...DEFAULT_ROUTE_SETTINGS,optimizerEnabled:true,optimizerPasses:2},new Set());
 expect(result.barrelsRemoved).toBe(1);expect(layout.barrels.map(b=>b.id)).toEqual([101]);
 expect(connectivity(layout,lattice).componentOf.get(200)).toBe(connectivity(layout,lattice).componentOf.get(201));
});
test('remove an isolated barrel with no surviving component members',()=>{
 const layout={...fixture(),tracks:[]};const lattice=buildLattice(layout);const journal=createJournal(layout,lattice);
 expect(runOptimise(layout,lattice,journal,{...DEFAULT_ROUTE_SETTINGS,optimizerEnabled:true},new Set()).barrelsRemoved).toBe(1);
});
