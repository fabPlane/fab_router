/** Research transaction locality, independent of route completion and DRC gates. */
import {test,expect} from 'bun:test';
import {emptyLayout} from '../src/layout/index.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {checkDrc,requiredConnections} from '../src/api.ts';
import type {Barrel,Track} from '../spec/types/layout.ts';
import {copperWithinRegion,tryRecoveryTransaction} from '../src/route/recovery-transaction.ts';

function board(){
 const l=emptyLayout('recovery-region');
 l.stack=[0,1].map(id=>({id,name:`sheet${id}`,role:'signal' as const,active:true,preferDir:null}));
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:20}]]])},
  {id:1,name:'asymmetric-via',attachAllowed:true,
   perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:10}]],[1,[{kind:'disk',c:{x:40,y:0},r:10}]]]),
   drill:{diameter:60,fromSheet:0,toSheet:1}}];
 l.pads=[0,1].map(id=>({id,part:0,pinName:String(id),net:0,form:0,at:{x:id*1000,y:0},
  rotationDeg:0,side:'front' as const,sheets:[0],kind:0,hold:'locked' as const}));
 l.nets=[{id:0,name:'target',group:0,pads:[0,1]}];
 return l;
}
const track:Track={id:2,net:0,sheet:0,pts:[{x:0,y:0},{x:1000,y:0}],width:20,kind:0,hold:'free',origin:'router'};
const region={x0:-10,y0:-10,x1:1010,y1:10};

test('region includes track caps, all via sheets and drill radius',()=>{
 const l=board();
 expect(copperWithinRegion(l,track,region)).toBe(true);
 for(const edge of ['x0','y0','x1','y1'] as const){
  expect(copperWithinRegion(l,track,{...region,[edge]:region[edge]+(edge.endsWith('0')?0.5:-0.5)})).toBe(false);
 }
 expect(copperWithinRegion(l,{...track,pts:[{x:0,y:0}]},{x0:-10,y0:-10,x1:10,y1:10})).toBe(true);
 expect(copperWithinRegion(l,{...track,pts:[]},region)).toBe(false);
 const via:Barrel={id:3,net:0,at:{x:0,y:0},form:1,fromSheet:0,toSheet:1,kind:0,hold:'free',origin:'router'};
 const box={x0:-30,y0:-30,x1:50,y1:30};
 expect(copperWithinRegion(l,via,box)).toBe(true);
 expect(copperWithinRegion(l,via,{...box,x1:49.5})).toBe(false); // second sheet copper
 expect(copperWithinRegion(l,via,{...box,x0:-29.5})).toBe(false); // drill, beyond copper
 expect(copperWithinRegion(l,{...via,form:999},box)).toBe(false);
});

test('local transaction rejects remote removal, replacement and insertion while restoring live index',()=>{
 for(const action of ['remove','replace','insert'] as const){
  const l=board(),remote={...track,id:2,pts:[{x:10000,y:0},{x:11000,y:0}]};
  l.tracks=[remote];
  const lattice=buildLattice(l),journal=createJournal(l,lattice),mark=journal.mark();
  const target={net:0,from:0,to:1};
  const add=()=>journal.addTrack({...track,id:3});
  expect(checkDrc(l).counts.violations).toBe(0);
  expect(requiredConnections(l)).toHaveLength(1);
  expect(tryRecoveryTransaction(l,lattice,journal,target,()=>{
   if(action!=='insert')journal.remove(2);
   if(action==='replace')journal.addTrack({...track,id:2});
   if(action==='insert')journal.addTrack({...remote,id:4});
   add();
   expect(checkDrc(l).counts.violations).toBe(0);
   expect(requiredConnections(l)).toHaveLength(0);
  },region)).toBe('region');
  expect(l.tracks).toEqual([remote]);
  expect(lattice.itemOf(2)?.item).toEqual(remote);
  expect(lattice.itemOf(3)).toBeUndefined();
  expect(lattice.itemOf(4)).toBeUndefined();
  expect(journal.insertedSince(mark)).toEqual([]);
  expect(checkDrc(l).counts.violations).toBe(0);
  expect(requiredConnections(l)).toHaveLength(1);
  expect(tryRecoveryTransaction(l,lattice,journal,target,()=>{add();},region)).toBe('kept');
  expect(requiredConnections(l)).toHaveLength(0);
  journal.rewind(mark);
  expect(l.tracks).toEqual([remote]);
  let called=false;
  for(const bad of [{...region,x0:NaN},{...region,x0:Infinity},{...region,x0:1011}]){
   expect(()=>tryRecoveryTransaction(l,lattice,journal,target,()=>{called=true;},bad)).toThrow('Invalid recovery region');
  }
  expect(called).toBe(false);
 }
});
