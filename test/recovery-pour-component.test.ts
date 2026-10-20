import {test,expect} from 'bun:test';
import {emptyLayout,makeSpacingTable} from '../src/layout/index.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {checkDrc,requiredConnections,writeSes} from '../src/api.ts';
import {recoverRemaining} from '../src/route/recover-remaining.ts';
import {buildLattice} from '../src/lattice/index.ts';
import {createJournal} from '../src/route/journal.ts';
import {scheduleRecovery} from '../src/route/recovery-schedule.ts';

function fixture(reverse=false){
 const l=emptyLayout('pour-component-stall');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[0,1].map(id=>({id,name:`sheet-${id}`,role:'signal' as const,active:true,preferDir:null}));
 l.padForms=[{id:0,name:'round',attachAllowed:true,perSheet:new Map([0,1].map(id=>[id,[{kind:'disk' as const,c:{x:0,y:0},r:300}]]))}];
 l.pads=[{id:0,part:0,pinName:'0',net:0,form:0,at:{x:0,y:0},rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const},
 {id:2,part:1,pinName:'2',net:0,form:0,at:{x:12000,y:0},rotationDeg:0,side:'front' as const,sheets:[0,1],kind:1,hold:'locked' as const}];
 l.pours=[{id:1,net:0,sheet:1,outline:[{x:9000,y:-3000},{x:15000,y:-3000},{x:15000,y:3000},{x:9000,y:3000}],holes:[],kind:1,hold:'locked'}];
 l.nets=[{id:0,name:'target',group:0,pads:[0,2]}];
 l.netGroups=[{id:0,name:'default',nets:[0],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1}}];
 if(reverse){l.pads=l.pads.map(p=>({...p,id:p.id===0?1:p.id}));l.pours=l.pours.map(p=>({...p,id:0}));l.nets=l.nets.map(n=>({...n,pads:[1,2]}));}
 return l;
}
for(const reverse of [false,true])test(`pour component can be reached through an existing pad, reversed=${reverse}`,()=>{
 const sessions=[];
 for(let i=0;i<3;i++){
  const l=fixture(reverse),saved=JSON.stringify([l.pads,l.pours]),settings=resolveSettings({},undefined,l.angleMode);
  expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
  const result=recoverRemaining(l,settings,true);
  expect(result.targets.map(t=>t.status)).toEqual(['kept']);
  expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
  expect(JSON.stringify([l.pads,l.pours])).toBe(saved);expect(l.tracks).toHaveLength(1);expect(l.barrels).toHaveLength(0);
  expect(l.tracks[0]!.sheet).toBe(0);expect(l.tracks[0]!.width).toBe(200);sessions.push(writeSes(l));
 }
 expect(new Set(sessions).size).toBe(1);
});
test('an isolated same-net pad cannot stand in for the pour component',()=>{
 const l=fixture();l.pours=l.pours.map(p=>({...p,holes:[[{x:11000,y:-1000},{x:13000,y:-1000},{x:13000,y:1000},{x:11000,y:1000}]]}));
 // Pad is inside the pour hole and thus in another component.
 const settings=resolveSettings({},undefined,l.angleMode),before=writeSes(l);
 const result=recoverRemaining(l,settings,true,1);
 expect(result.targets[0]!.status).toBe('unsupported-endpoints');expect(writeSes(l)).toBe(before);
 expect(checkDrc(l).counts.violations).toBe(0);
});
test('a component anchor needs a shared physical sheet',()=>{
 const l=fixture();l.pads=l.pads.map(p=>p.id===2?{...p,sheets:[1]}:p);
 const before=writeSes(l),result=recoverRemaining(l,resolveSettings({},undefined,l.angleMode),true);
 expect(result.targets[0]!.status).toBe('unsupported-endpoints');expect(writeSes(l)).toBe(before);
});

// A via-linked point can reach a pour without itself being a terminal.
function barrelFixture(){
 const l=fixture();l.pads=l.pads.map(p=>p.id===2?{...p,at:{x:14000,y:0},sheets:[1]}:p);
 l.barrels=[{id:3,net:0,at:{x:10000,y:6000},form:0,fromSheet:0,toSheet:1,kind:1,hold:'free',origin:'router'}];
 l.tracks=[{id:4,net:0,sheet:1,pts:[{x:10000,y:6000},{x:14000,y:0}],width:200,kind:1,hold:'free',origin:'router'}];
 return l;
}
test('a barrel in the live pour component is a legal point anchor',()=>{
 const l=barrelFixture(),before=JSON.stringify(l.tracks[0]),result=recoverRemaining(l,resolveSettings({},undefined,l.angleMode),true);
 expect(result.targets[0]!.status).toBe('kept');expect(result.targets[0]!.anchorPair).toMatchObject({net:0,from:0,to:3});
 expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
 expect(JSON.stringify(l.tracks.find(t=>t.id===4))).toBe(before);
});
test('alternate anchors cannot replace the original terminal acceptance gate',()=>{
 const l=barrelFixture(),before=writeSes(l),lattice=buildLattice(l),journal=createJournal(l,lattice);
 const result=scheduleRecovery(l,lattice,journal,{net:0,from:0,to:1},
  {enabled:true,pitch:300,margins:[16],maxAttempts:1,maxExpansions:100,maxMilliseconds:1000},trial=>{
   trial.expand();journal.remove(4);
   journal.addTrack({net:0,sheet:0,pts:[{x:0,y:0},{x:10000,y:6000}],width:200,kind:1,hold:'free'});
  },{}, {net:0,from:0,to:3});
 expect(result.status).toBe('exhausted');expect(result.trials[0]!.outcome).toBe('open');
 expect(writeSes(l)).toBe(before);expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
});
test('alternate anchors must belong to the requested terminal components',()=>{
 const l=fixture(),lattice=buildLattice(l),journal=createJournal(l,lattice),before=writeSes(l);
 expect(()=>scheduleRecovery(l,lattice,journal,{net:0,from:0,to:1},
  {enabled:true,pitch:300,margins:[16],maxAttempts:1,maxExpansions:100,maxMilliseconds:1000},()=>{throw Error('must not propose');},
  {},{net:0,from:2,to:0})).toThrow('Recovery anchors must belong to target components');
 expect(writeSes(l)).toBe(before);
});
