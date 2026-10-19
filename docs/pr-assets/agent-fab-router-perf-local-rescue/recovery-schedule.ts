/** Research only: explicit opt-in, pad-to-pad post-pass proposal scheduling.
 * Trusted synchronous Journal-only callbacks must charge every search expansion.
 * This is a cooperative search budget, not preemption or a mutation sandbox.
 */
import type {Layout,Box} from '../../../spec/types/layout.ts';
import type {Lattice} from '../../../src/lattice/index.ts';
import type {Journal} from '../../../src/route/journal.ts';
import {connectivity} from '../../../src/drc/connect.ts';
import {tryRecoveryTransaction} from './recovery-transaction.ts';

type Target={net:number;from:number;to:number};
type Outcome=ReturnType<typeof tryRecoveryTransaction>;
export interface RecoveryPlan {
 enabled:boolean;
 pitch:number;
 margins:readonly number[];
 maxAttempts:number;
 maxExpansions:number;
 maxMilliseconds:number;
}
export interface RecoveryTrial {
 region:Box;
 /** Call BEFORE each search expansion, shared across all attempts for this target. */
 expand():void;
}
export function scheduleRecovery(
 layout:Layout,lattice:Lattice,journal:Journal,target:Target,plan:RecoveryPlan,
 propose:(trial:RecoveryTrial)=>void,
):{status:'disabled'|'joined'|'kept'|'exhausted'|'budget';expansions:number;trials:{margin:number;region:Box;outcome:Outcome|'budget'}[]} {
 const trials:{margin:number;region:Box;outcome:Outcome|'budget'}[]=[];
 if(!plan.enabled)return {status:'disabled',expansions:0,trials};
 const integer=(n:number)=>Number.isSafeInteger(n)&&n>0;
 if(!Number.isFinite(plan.pitch)||plan.pitch<=0||!integer(plan.maxAttempts)||!integer(plan.maxExpansions)||
  !Number.isFinite(plan.maxMilliseconds)||plan.maxMilliseconds<=0||!plan.margins.length||
  plan.margins.some((n,i)=>!Number.isFinite(n)||n<0||(i>0&&n<=plan.margins[i-1]!)))throw Error('Invalid recovery plan');
 const from=layout.pads.find(p=>p.id===target.from),to=layout.pads.find(p=>p.id===target.to);
 if(!from||!to||from.net!==target.net||to.net!==target.net)throw Error('Recovery schedule requires pad endpoints on target net');
 // Build all boxes before calling proposals, including overflow checks.
 const regions=plan.margins.map(margin=>{
  const extra=margin*plan.pitch;
  const region={x0:Math.min(from.at.x,to.at.x)-extra,y0:Math.min(from.at.y,to.at.y)-extra,
   x1:Math.max(from.at.x,to.at.x)+extra,y1:Math.max(from.at.y,to.at.y)+extra};
  if(!Object.values(region).every(Number.isFinite))throw Error('Invalid recovery region');
  return {margin,region};
 });
 const c=connectivity(layout,lattice);
 if(c.componentOf.get(from.id)===c.componentOf.get(to.id))return {status:'joined',expansions:0,trials};
 const deadline=performance.now()+plan.maxMilliseconds,budget=Symbol('recovery budget');
 let expansions=0;
 const check=()=>{if(performance.now()>=deadline)throw budget;};
 for(const {margin,region} of regions.slice(0,plan.maxAttempts)){
  if(expansions>=plan.maxExpansions||performance.now()>=deadline)return {status:'budget',expansions,trials};
  let outcome:Outcome;
  try {
   outcome=tryRecoveryTransaction(layout,lattice,journal,target,()=>{
    check();
    propose({region:{...region},expand(){check();if(expansions>=plan.maxExpansions)throw budget;expansions++;}});
    check(); // Reject and rewind even a legal closure returned after its deadline.
   },region);
  }catch(error){
   if(error!==budget)throw error;
   trials.push({margin,region,outcome:'budget'});return {status:'budget',expansions,trials};
  }
  trials.push({margin,region,outcome});
  if(outcome==='kept')return {status:'kept',expansions,trials};
 }
 return {status:'exhausted',expansions,trials};
}
