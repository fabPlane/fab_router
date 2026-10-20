/** Small near-complete-stall fixture and transaction safety counterexamples. */
import {strict as assert} from 'node:assert';
import {writeFileSync} from 'node:fs';
import {emptyLayout,makeSpacingTable} from '../../../../src/layout/index.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {checkDrc,requiredConnections,writeSes} from '../../../../src/api.ts';
import {buildLattice} from '../../../../src/lattice/index.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {recoverRemaining} from '../../../../src/route/recover-remaining.ts';
import {barrelFits,ignoreOf} from '../../../../src/route/clear.ts';
import {tryRecoveryTransaction} from '../../../../src/route/recovery-transaction.ts';
function fixture(){
 const l=emptyLayout('one-open-pour-stall');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[0,1].map(id=>({id,name:`sheet-${id}`,role:'signal' as const,active:true,preferDir:null}));
 l.padForms=[{id:0,name:'permitted-via',attachAllowed:false,drill:{diameter:200,fromSheet:0,toSheet:1},perSheet:new Map([0,1].map(id=>[id,[{kind:'disk' as const,c:{x:0,y:0},r:300}]]))}];
 l.pours=[0,1].map(id=>({id,net:0,sheet:id,outline:[{x:-3000,y:-3000},{x:3000,y:-3000},{x:3000,y:3000},{x:-3000,y:3000}],holes:[],kind:1,hold:'locked' as const}));
 l.nets=[{id:0,name:'target',group:0,pads:[]},{id:1,name:'foreign',group:0,pads:[]}];
 l.netGroups=[{id:0,name:'default',nets:[0,1],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1},viaRule:0}];
 l.viaRules=[{id:0,name:'allowed',forms:[0],entries:[{form:0,kind:1,attach:false}]}];return l;
}
const rows=[];
for(let repeat=1;repeat<=3;repeat++)for(const mode of ['legal','hole','blocked','region','cancelled','vias-disabled']){
 const l=fixture();
 if(mode==='hole')l.pours=l.pours.map(p=>p.id===0?{...p,holes:[[{x:-1000,y:-1000},{x:1000,y:-1000},{x:1000,y:1000},{x:-1000,y:1000}]]}:p);
 if(mode==='blocked')l.tracks=[{id:2,net:1,sheet:0,pts:[{x:-2000,y:0},{x:2000,y:0}],width:200,kind:1,hold:'locked',origin:'file'}];
 const settings=resolveSettings({viasAllowed:mode!=='vias-disabled'},undefined,l.angleMode),profile=resolveProfile(l,0,settings),saved=writeSes(l),fixed=JSON.stringify([l.pads,l.pours,l.fences]);
 assert.equal(checkDrc(l).counts.violations,0);assert.equal(requiredConnections(l).length,1);
 const normal=recoverRemaining(l,settings,true);assert.equal(normal.targets[0]!.status,'unsupported-endpoints');assert.equal(writeSes(l),saved);
 const lattice=buildLattice(l),journal=createJournal(l,lattice),candidate=profile.barrelForms[0];let outcome:string;
 if(mode==='vias-disabled'){assert.equal(candidate,undefined);outcome='no-permitted-via';}
 else{
  assert(candidate);const fit=barrelFits(l,lattice,{x:0,y:0},candidate,profile,ignoreOf(0));assert.equal(fit.ok,mode!=='blocked');
  const proposal=()=>journal.addBarrel({net:0,at:{x:0,y:0},form:candidate.form,fromSheet:candidate.fromSheet,toSheet:candidate.toSheet,kind:candidate.kind,hold:'free'});
  const region=mode==='region'?{x0:-100,y0:-100,x1:100,y1:100}:{x0:-500,y0:-500,x1:500,y1:500};
  let checkpoints=0;
  try{outcome=tryRecoveryTransaction(l,lattice,journal,{net:0,from:0,to:1},proposal,region,()=>{if(mode==='cancelled'&&++checkpoints===2)throw Error('cancelled');});}
  catch(e){assert.equal(mode,'cancelled');assert.equal((e as Error).message,'cancelled');outcome='cancelled';}
 }
 const expected:Record<string,string>={legal:'kept',hole:'open',blocked:'drc',region:'region',cancelled:'cancelled','vias-disabled':'no-permitted-via'};
 assert.equal(outcome,expected[mode]);assert.equal(JSON.stringify([l.pads,l.pours,l.fences]),fixed);assert.equal(checkDrc(l).counts.violations,0);
 if(mode==='legal'){assert.equal(requiredConnections(l).length,0);assert.equal(l.barrels.length,1);}else{assert.equal(writeSes(l),saved);assert.equal(requiredConnections(l).length,1);assert.equal(l.barrels.length,0);}
 rows.push({repeat,mode,normalStatus:normal.targets[0]!.status,outcome,incomplete:requiredConnections(l).length,exact:checkDrc(l).counts.violations,failedTrialsRewound:mode==='legal'?null:true});
}
writeFileSync(process.argv[2]??import.meta.dir+'/controls.json',JSON.stringify({scope:'18 offline fixture evaluations; not a router score or native evidence',rows},null,2)+'\n');console.log('PASS six fixture scenarios × three repeats; exact0; all rejected/cancelled trials rewind');
