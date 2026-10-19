/** Explicit research post-pass. No production imports or default changes.
 * Snapshot actual incomplete connections after normal routing, resolve each net's
 * profile independently and recheck connectivity in the scheduler. Ignored nets
 * remain obstacles. This insertion-only search does not rip or relax any rule.
 */
import type {Layout} from '../../../spec/types/layout.ts';
import type {RouteSettings} from '../../../spec/types/settings.ts';
import {checkDrc,requiredConnections} from '../../../src/drc/index.ts';
import {buildLattice} from '../../../src/lattice/index.ts';
import {createJournal} from '../../../src/route/journal.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {scheduleRecovery} from './recovery-schedule.ts';
import {proposeVisibility} from './visibility-recovery.ts';
export function recoverRemaining(layout:Layout,settings:RouteSettings,enabled=false,maxTargets=16,includeCopperCorners=false){
 if(!enabled)return {status:'disabled' as const,targets:[]};
 if(!Number.isSafeInteger(maxTargets)||maxTargets<1||maxTargets>64)throw Error('Invalid recovery target cap');
 if(!settings.routerEnabled)return {status:'router-disabled' as const,targets:[]};
 if(checkDrc(layout).counts.violations)return {status:'dirty-baseline' as const,targets:[]};
 const ignored=new Set(layout.netGroups.filter(g=>settings.ignoreNetGroups.includes(g.name)).flatMap(g=>g.nets));
 const pending=requiredConnections(layout).filter(c=>!ignored.has(c.net));
 const lattice=buildLattice(layout),journal=createJournal(layout,lattice);
 const targets=pending.slice(0,maxTargets).map(pair=>{
  const profile=resolveProfile(layout,pair.net,settings);
  // Current graph supports pad endpoints only. Do not reinterpret pour/track ids.
  if(!layout.pads.some(p=>p.id===pair.from&&p.net===pair.net)||!layout.pads.some(p=>p.id===pair.to&&p.net===pair.net))return {pair,status:'unsupported-endpoints' as const};
  const proposals:ReturnType<typeof proposeVisibility>[]=[];
  const start=performance.now();
  const result=scheduleRecovery(layout,lattice,journal,pair,{
   enabled:true,pitch:profile.width+profile.maxSpacing,margins:[0,4,8,16],maxAttempts:4,maxExpansions:100000,maxMilliseconds:15000,
  },trial=>{proposals.push(proposeVisibility(layout,lattice,journal,pair,profile,trial,512,includeCopperCorners));});
  return {pair,status:result.status,result,proposals,seconds:(performance.now()-start)/1000};
 });
 return {status:'finished' as const,pending:pending.length,truncated:pending.length>maxTargets,targets};
}
