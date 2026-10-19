import {recoveryEndpoint} from './recovery-endpoint.ts';
/** Default-off local recovery post-pass.
 * Snapshot actual incomplete connections after normal routing, resolve each net's
 * profile independently and recheck connectivity in the scheduler. Ignored nets
 * remain obstacles. This insertion-only search does not rip or relax any rule.
 */
import type {RouteHooks} from '../../spec/types/results.ts';
import type {Layout} from '../../spec/types/layout.ts';
import type {RouteSettings} from '../../spec/types/settings.ts';
import {checkDrc,requiredConnections} from '../drc/index.ts';
import {connectivity} from '../drc/connect.ts';
import {barrelSheets} from '../lattice/index.ts';
import {buildLattice} from '../lattice/index.ts';
import {createJournal} from './journal.ts';
import {resolveProfile} from './profile.ts';
import {scheduleRecovery,type RecoveryControl} from './recovery-schedule.ts';
import {proposeVisibility} from './visibility-recovery.ts';
type PointTarget={net:number;from:number;to:number};
type RecoveryTarget={anchorPair?:PointTarget;pair:ReturnType<typeof requiredConnections>[number];status:'unsupported-endpoints'|ReturnType<typeof scheduleRecovery>['status'];result?:ReturnType<typeof scheduleRecovery>;proposals?:ReturnType<typeof proposeVisibility>[];seconds?:number};
export function recoverRemaining(layout:Layout,settings:RouteSettings,enabled=false,maxTargets=16,includeCopperCorners=false,control:RecoveryControl={},hooks?:RouteHooks,resources?:{lattice:ReturnType<typeof buildLattice>;journal:ReturnType<typeof createJournal>}){
 if(!enabled)return {status:'disabled' as const,targets:[]};
 if(!Number.isSafeInteger(maxTargets)||maxTargets<1||maxTargets>64)throw Error('Invalid recovery target cap');
 if(!settings.routerEnabled)return {status:'router-disabled' as const,targets:[]};
 if(control.deadline!==undefined&&!Number.isFinite(control.deadline))throw Error('Invalid recovery deadline');
 const stop=()=>control.signal?.aborted?'aborted' as const:control.deadline!==undefined&&performance.now()>=control.deadline?'deadline' as const:undefined;
 const initial=stop();if(initial)return {status:initial,targets:[]};
 const ignored=new Set(layout.netGroups.filter(g=>settings.ignoreNetGroups.includes(g.name)).flatMap(g=>g.nets));
 const pending=requiredConnections(layout).filter(c=>!ignored.has(c.net));
 if(!pending.length)return {status:'finished' as const,pending:0,truncated:false,targets:[]};
 const afterCollection=stop();if(afterCollection)return {status:afterCollection,pending:pending.length,targets:[]};
 if(checkDrc(layout).counts.violations)return {status:'dirty-baseline' as const,targets:[]};
 const afterDrc=stop();if(afterDrc)return {status:afterDrc,pending:pending.length,targets:[]};
 const lattice=resources?.lattice??buildLattice(layout),journal=resources?.journal??createJournal(layout,lattice);
 const targets:RecoveryTarget[]=[];
 for(const pair of pending.slice(0,maxTargets)){
  const reason=stop();if(reason)return {status:reason,pending:pending.length,targets};
  hooks?.onLog?.('info',`local-recovery attempt net=${pair.net} from=${pair.from} to=${pair.to}`);
  const afterHook=stop();if(afterHook)return {status:afterHook,pending:pending.length,targets};
  const profile=resolveProfile(layout,pair.net,settings);
  // Keep ordinary point targets byte-for-byte on their existing search path.
  // A pour may already share a component with a pad/barrel on the other anchor's
  // sheet. Reach that existing copper instead of inventing a pour contact point.
  let anchorPair:PointTarget=pair;
  const from=recoveryEndpoint(layout,pair.from,pair.net),to=recoveryEndpoint(layout,pair.to,pair.net);
  if(!from||!to){
   const point=from??to,missing=from?pair.to:pair.from;
   const pour=layout.pours.find(p=>p.id===missing&&p.net===pair.net);
   if(!point||!pour){targets.push({pair,status:'unsupported-endpoints'});continue;}
   const c=connectivity(layout,lattice),component=c.componentOf.get(pour.id);
   if(component===undefined){targets.push({pair,status:'unsupported-endpoints'});continue;}
   let best:{id:number;distance:number}|undefined;
   const consider=(id:number,net:number|null,at:{x:number;y:number},sheets:readonly number[])=>{
    if(net!==pair.net||c.componentOf.get(id)!==component||!sheets.some(s=>point.sheets.includes(s)&&profile.sheets.includes(s)))return;
    const distance=Math.hypot(at.x-point.at.x,at.y-point.at.y);
    if(!best||distance<best.distance||(distance===best.distance&&id<best.id))best={id,distance};
   };
   for(const pad of layout.pads){if(stop())break;consider(pad.id,pad.net,pad.at,pad.sheets);}
   for(const barrel of layout.barrels){if(stop())break;consider(barrel.id,barrel.net,barrel.at,barrelSheets(layout,barrel));}
   const stopped=stop();if(stopped)return {status:stopped,pending:pending.length,targets};
   if(!best){targets.push({pair,status:'unsupported-endpoints'});continue;}
   anchorPair=from?{...pair,to:best.id}:{...pair,from:best.id};
  }
  const proposals:ReturnType<typeof proposeVisibility>[]=[];
  const start=performance.now();
  const result=scheduleRecovery(layout,lattice,journal,pair,{
   enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000,
  },trial=>{proposals.push(proposeVisibility(layout,lattice,journal,anchorPair,profile,trial,512,includeCopperCorners));},control,anchorPair===pair?undefined:anchorPair);
  const seconds=(performance.now()-start)/1000;
  targets.push({pair,...(anchorPair===pair?{}:{anchorPair}),status:result.status,result,proposals,seconds});
  hooks?.onConnection?.({net:layout.nets.find(n=>n.id===pair.net)?.name??String(pair.net),from:String(pair.from),to:String(pair.to),ok:result.status==='kept'||result.status==='joined',elapsedMs:seconds*1000});
  hooks?.onLog?.('info',`local-recovery result ${JSON.stringify(targets[targets.length-1])}`);
  if(result.status==='deadline'||result.status==='aborted')return {status:result.status,pending:pending.length,targets};
 }
 return {status:'finished' as const,pending:pending.length,truncated:pending.length>maxTargets,targets};
}
