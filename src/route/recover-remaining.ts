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
import {buildLattice} from '../lattice/index.ts';
import {createJournal} from './journal.ts';
import {resolveProfile} from './profile.ts';
import {scheduleRecovery,type RecoveryControl} from './recovery-schedule.ts';
import {proposeVisibility} from './visibility-recovery.ts';
type RecoveryTarget={pair:ReturnType<typeof requiredConnections>[number];status:'unsupported-endpoints'|ReturnType<typeof scheduleRecovery>['status'];result?:ReturnType<typeof scheduleRecovery>;proposals?:ReturnType<typeof proposeVisibility>[];seconds?:number};
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
  // Point anchors only; pour attachment remains unsupported.
  if(!recoveryEndpoint(layout,pair.from,pair.net)||!recoveryEndpoint(layout,pair.to,pair.net)){targets.push({pair,status:'unsupported-endpoints'});continue;}
  const proposals:ReturnType<typeof proposeVisibility>[]=[];
  const start=performance.now();
  const result=scheduleRecovery(layout,lattice,journal,pair,{
   enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000,
  },trial=>{proposals.push(proposeVisibility(layout,lattice,journal,pair,profile,trial,512,includeCopperCorners));},control);
  const seconds=(performance.now()-start)/1000;
  targets.push({pair,status:result.status,result,proposals,seconds});
  hooks?.onConnection?.({net:layout.nets.find(n=>n.id===pair.net)?.name??String(pair.net),from:String(pair.from),to:String(pair.to),ok:result.status==='kept'||result.status==='joined',elapsedMs:seconds*1000});
  hooks?.onLog?.('info',`local-recovery result ${JSON.stringify(targets[targets.length-1])}`);
  if(result.status==='deadline'||result.status==='aborted')return {status:result.status,pending:pending.length,targets};
 }
 return {status:'finished' as const,pending:pending.length,truncated:pending.length>maxTargets,targets};
}
