/** Offline experiment only. No production entrypoint imports this module.
 * All pairs share one cooperative work/deadline budget. Connectivity and exact
 * validation remain synchronous; this is not a hard wall-clock latency bound.
 */
import type {Layout} from '../../../../spec/types/layout.ts';
import type {RouteSettings} from '../../../../spec/types/settings.ts';
import {connectivity} from '../../../../src/drc/connect.ts';
import {buildLattice,barrelSheets} from '../../../../src/lattice/index.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {recoveryEndpoint} from '../../../../src/route/recovery-endpoint.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {scheduleRecovery,type RecoveryControl} from '../../../../src/route/recovery-schedule.ts';
import {proposeVisibility} from '../../../../src/route/visibility-recovery.ts';

type Target={net:number;from:number;to:number};
type Status='kept'|'joined'|'exhausted'|'budget'|'deadline'|'aborted'|'items'|'unsupported';
type Options={maxWork?:number;maxMilliseconds?:number;maxPairs?:number;maxItems?:number};
export function recoverPointComponent(layout:Layout,settings:RouteSettings,target:Target,control:RecoveryControl={},options:Options={}){
 const maxWork=options.maxWork??100000,maxMilliseconds=options.maxMilliseconds??15000,maxPairs=options.maxPairs??8,maxItems=options.maxItems??1;
 if(!Number.isSafeInteger(maxWork)||maxWork<1||maxWork>100000||!Number.isFinite(maxMilliseconds)||maxMilliseconds<=0||maxMilliseconds>15000||
  !Number.isSafeInteger(maxPairs)||maxPairs<1||maxPairs>8||!Number.isSafeInteger(maxItems)||maxItems<0||maxItems>1||
  (control.deadline!==undefined&&!Number.isFinite(control.deadline)))throw Error('Invalid offline recovery limits');
 const start=performance.now(),localDeadline=start+maxMilliseconds;
 let work=0,enumeration=0;
 const attempts:{anchor:Target;result:ReturnType<typeof scheduleRecovery>;proposals:ReturnType<typeof proposeVisibility>[]}[]=[];
 const finish=(status:Status)=>({status,work,enumeration,attempts,seconds:(performance.now()-start)/1000});
 const stopped=():Status|undefined=>control.signal?.aborted?'aborted':
  control.deadline!==undefined&&performance.now()>=control.deadline?'deadline':
  performance.now()>=localDeadline||work>=maxWork?'budget':undefined;
 let reason=stopped();if(reason)return finish(reason);
 if(!maxItems)return finish('items');
 const profile=resolveProfile(layout,target.net,settings);
 if(!recoveryEndpoint(layout,target.from,target.net)||!recoveryEndpoint(layout,target.to,target.net))return finish('unsupported');
 const lattice=buildLattice(layout),journal=createJournal(layout,lattice);
 const effectiveControl:RecoveryControl={...control,deadline:Math.min(control.deadline??Infinity,localDeadline)};
 const search=(anchor:Target):Status=>{
  const before=stopped();if(before)return before;
  const proposals:ReturnType<typeof proposeVisibility>[]=[];
  const result=scheduleRecovery(layout,lattice,journal,target,{
   enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,
   maxExpansions:maxWork-work,maxMilliseconds,
  },trial=>{proposals.push(proposeVisibility(layout,lattice,journal,anchor,profile,trial,512,true));},effectiveControl,
  anchor.from===target.from&&anchor.to===target.to?undefined:anchor);
  work+=result.expansions;attempts.push({anchor,result,proposals});
  // A local deadline is per-target exhaustion; the route deadline remains distinct.
  if(result.status==='deadline')return control.deadline!==undefined&&performance.now()>=control.deadline?'deadline':'budget';
  if(result.status==='disabled')throw Error('Enabled offline scheduler returned disabled');
  return result.status;
 };
 const original=search(target);
 if(original!=='exhausted')return finish(original);
 reason=stopped();if(reason)return finish(reason);
 const c=connectivity(layout,lattice);
 reason=stopped();if(reason)return finish(reason);
 const fromComponent=c.componentOf.get(target.from),toComponent=c.componentOf.get(target.to);
 if(fromComponent===undefined||toComponent===undefined)return finish('unsupported');
 const from:NonNullable<ReturnType<typeof recoveryEndpoint>>[]=[],to:typeof from=[];
 // Charge BEFORE examining each item or point pair. Keep only eight best pairs;
 // never materialise/sort an unbounded Cartesian-product array.
 const charge=()=>{const r=stopped();if(r)return r;work++;enumeration++;return undefined;};
 const collect=(item:Layout['pads'][number]|Layout['barrels'][number],sheets:()=>readonly number[])=>{
  const limit=charge();if(limit)return limit;
  if(item.net!==target.net)return;
  const component=c.componentOf.get(item.id);
  if(component!==fromComponent&&component!==toComponent)return;
  const p={id:item.id,at:item.at,sheets:sheets()};
  (component===fromComponent?from:to).push(p);
 };
 for(const pad of layout.pads){reason=collect(pad,()=>pad.sheets);if(reason)return finish(reason);}
 for(const barrel of layout.barrels){reason=collect(barrel,()=>barrelSheets(layout,barrel));if(reason)return finish(reason);}
 const pairs:(Target&{distance:number})[]=[];
 const compare=(a:typeof pairs[number],b:typeof pairs[number])=>a.distance-b.distance||a.from-b.from||a.to-b.to;
 for(const a of from)for(const b of to){
  reason=charge();if(reason)return finish(reason);
  if(a.id===target.from&&b.id===target.to||!a.sheets.some(s=>b.sheets.includes(s)&&profile.sheets.includes(s)))continue;
  const candidate={net:target.net,from:a.id,to:b.id,distance:Math.hypot(a.at.x-b.at.x,a.at.y-b.at.y)};
  let index=0;while(index<pairs.length&&compare(pairs[index]!,candidate)<=0)index++;
  if(index<maxPairs){pairs.splice(index,0,candidate);if(pairs.length>maxPairs)pairs.pop();}
 }
 for(const anchor of pairs){
  const status=search(anchor);if(status!=='exhausted')return finish(status);
 }
 return finish('exhausted');
}
