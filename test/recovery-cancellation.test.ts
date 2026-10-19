import {test,expect} from 'bun:test';
import {emptyLayout} from '../src/layout/index.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {writeSes,requiredConnections,checkDrc} from '../src/api.ts';
import {tryRecoveryTransaction} from '../src/route/recovery-transaction.ts';

test('cancellation detected after exact validation rolls back legal copper and its live index',()=>{
 const l=emptyLayout('cancel-after-validation');
 l.stack=[{id:0,name:'top',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:20}]]])}];
 l.pads=[0,1].map(id=>({id,part:0,pinName:String(id),net:0,form:0,at:{x:id*1000,y:0},rotationDeg:0,
  side:'front' as const,sheets:[0],kind:0,hold:'locked' as const}));
 l.nets=[{id:0,name:'target',group:0,pads:[0,1]}];
 const lattice=buildLattice(l),journal=createJournal(l,lattice),before=writeSes(l),stop=Error('cancel');
 let checkpoints=0;
 expect(()=>tryRecoveryTransaction(l,lattice,journal,{net:0,from:0,to:1},()=>{
  journal.addTrack({net:0,sheet:0,pts:[{x:0,y:0},{x:1000,y:0}],width:20,kind:0,hold:'free'});
 },undefined,()=>{
  if(++checkpoints===3){
   expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
   throw stop;
  }
 })).toThrow(stop);
 expect(checkpoints).toBe(3);expect(writeSes(l)).toBe(before);expect(journal.insertedSince(0)).toEqual([]);
 expect(lattice.itemOf(2)).toBeUndefined();expect(requiredConnections(l)).toHaveLength(1);
});
