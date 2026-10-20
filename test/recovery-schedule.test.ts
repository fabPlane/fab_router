import {test,expect,spyOn} from 'bun:test';
import {emptyLayout} from '../src/layout/index.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {checkDrc,requiredConnections,writeSes} from '../src/api.ts';
import {scheduleRecovery,type RecoveryPlan} from '../src/route/recovery-schedule.ts';
function fixture(){
 const l=emptyLayout('schedule');
 l.stack=[{id:0,name:'top',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:20}]]])}];
 l.pads=[0,1].map(id=>({id,part:0,pinName:String(id),net:0,form:0,at:{x:id*1000,y:0},rotationDeg:0,
  side:'front' as const,sheets:[0],kind:0,hold:'locked' as const}));
 l.nets=[{id:0,name:'target',group:0,pads:[0,1]}];
 const lattice=buildLattice(l),journal=createJournal(l,lattice);
 const add=()=>journal.addTrack({net:0,sheet:0,pts:[{x:0,y:0},{x:1000,y:0}],width:20,kind:0,hold:'free'});
 return {l,lattice,journal,add};
}
const target={net:0,from:0,to:1};
const plan:RecoveryPlan={enabled:true,pitch:10,margins:[0,1,2],maxAttempts:3,maxExpansions:5,maxMilliseconds:1000};
test('gradual endpoint region rejects narrow closure, restores index, then keeps legal full-width closure',()=>{
 for(let repeat=0;repeat<3;repeat++){
  const {l,lattice,journal,add}=fixture(),ses=writeSes(l);let calls=0;
  const result=scheduleRecovery(l,lattice,journal,target,plan,trial=>{
   expect(writeSes(l)).toBe(ses);expect(lattice.itemOf(2)).toBeUndefined();
   expect(journal.insertedSince(0)).toEqual([]);
   trial.expand();add();calls++;
   // Mutating the callback's box cannot enlarge the acceptance region.
   trial.region.x0=-10000;trial.region.y0=-10000;trial.region.x1=10000;trial.region.y1=10000;
  });
  expect(result.status).toBe('kept');expect(calls).toBe(2);expect(result.expansions).toBe(2);
  expect(result.trials.map(t=>t.outcome)).toEqual(['region','kept']);
  expect(result.trials[0]!.region).toEqual({x0:0,y0:0,x1:1000,y1:0});
  expect(result.trials[1]!.region).toEqual({x0:-10,y0:-10,x1:1010,y1:10});
  expect(checkDrc(l).counts.violations).toBe(0);expect(requiredConnections(l)).toHaveLength(0);
  expect(scheduleRecovery(l,lattice,journal,target,plan,()=>{throw Error('already joined');}).status).toBe('joined');
 }
});
test('shared expansion cap interrupts and rewinds partially inserted copper across attempts',()=>{
 const {l,lattice,journal,add}=fixture(),ses=writeSes(l);let calls=0;
 const result=scheduleRecovery(l,lattice,journal,target,{...plan,maxExpansions:3},trial=>{
  calls++;trial.expand();add();trial.expand();
 });
 expect(result.status).toBe('budget');expect(result.expansions).toBe(3);expect(calls).toBe(2);
 expect(result.trials.map(t=>t.outcome)).toEqual(['region','budget']);
 expect(writeSes(l)).toBe(ses);expect(journal.insertedSince(0)).toEqual([]);
 expect(lattice.itemOf(2)).toBeUndefined();expect(lattice.itemOf(3)).toBeUndefined();
 expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
});
test('attempt cap, opt-out, invalid plans and proposal exceptions do not leak copper',()=>{
 const {l,lattice,journal,add}=fixture(),ses=writeSes(l);let calls=0;
 expect(scheduleRecovery(l,lattice,journal,target,{...plan,enabled:false},()=>{calls++;}).status).toBe('disabled');
 expect(calls).toBe(0);
 expect(scheduleRecovery(l,lattice,journal,target,{...plan,maxAttempts:1},()=>{calls++;add();}).status).toBe('exhausted');
 expect(calls).toBe(1);expect(writeSes(l)).toBe(ses);
 for(const bad of [{pitch:0},{margins:[2,1]},{maxAttempts:1.5},{maxExpansions:0},{maxMilliseconds:NaN},{pitch:Number.MAX_VALUE}]){
  expect(()=>scheduleRecovery(l,lattice,journal,target,{...plan,...bad},()=>{calls++;})).toThrow();
 }
 expect(calls).toBe(1);
 expect(()=>scheduleRecovery(l,lattice,journal,target,plan,()=>{add();throw Error('interrupted');})).toThrow('interrupted');
 expect(writeSes(l)).toBe(ses);expect(journal.insertedSince(0)).toEqual([]);
});

test('late legal proposals are rewound and do not start another region',()=>{
 const {l,lattice,journal,add}=fixture(),ses=writeSes(l);let now=0,calls=0;
 const timer=spyOn(performance,'now').mockImplementation(()=>now);
 try {
  const result=scheduleRecovery(l,lattice,journal,target,{...plan,margins:[1,2],maxMilliseconds:10},trial=>{
   calls++;trial.expand();add();now=10;
  });
  expect(result.status).toBe('budget');expect(calls).toBe(1);
  expect(result.trials.map(t=>t.outcome)).toEqual(['budget']);
  expect(writeSes(l)).toBe(ses);expect(journal.insertedSince(0)).toEqual([]);
  expect(lattice.itemOf(2)).toBeUndefined();expect(requiredConnections(l)).toHaveLength(1);
 } finally {timer.mockRestore();}
});

test('route-wide cancellation stops immediately and rewinds a partly inserted proposal',()=>{
 for(const reason of ['aborted','deadline'] as const){
  const {l,lattice,journal,add}=fixture(),ses=writeSes(l),controller=new AbortController();
  let now=0,calls=0;
  const timer=spyOn(performance,'now').mockImplementation(()=>now);
  try {
   const result=scheduleRecovery(l,lattice,journal,target,{...plan,margins:[1,2]},trial=>{
    calls++;trial.expand();add();
    if(reason==='aborted')controller.abort();else now=5;
    trial.expand();
   },{deadline:5,signal:controller.signal});
   expect(result.status).toBe(reason);expect(calls).toBe(1);expect(result.expansions).toBe(1);
   expect(result.trials.map(t=>t.outcome)).toEqual([reason]);
   expect(writeSes(l)).toBe(ses);expect(journal.insertedSince(0)).toEqual([]);
   expect(lattice.itemOf(2)).toBeUndefined();expect(requiredConnections(l)).toHaveLength(1);
   expect(checkDrc(l).counts.violations).toBe(0);
   if(reason==='deadline')now=5;else controller.abort();
   const stopped=scheduleRecovery(l,lattice,journal,target,plan,()=>{calls++;},{deadline:5,signal:controller.signal});
   expect(stopped.status).toBe(reason);expect(stopped.trials).toEqual([]);expect(calls).toBe(1);
  }finally{timer.mockRestore();}
 }
});
