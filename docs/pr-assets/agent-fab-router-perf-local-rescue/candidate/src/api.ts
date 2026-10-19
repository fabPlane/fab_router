/** Explicit opt-in research adapter for --fab-router-source. Not the public API.
 * Run the unmodified normal pipeline, then insertion-only local recovery. No
 * recovery on aborted/timed-out runs or when the normal item cap is exhausted.
 * Native scoring remains entirely in the unchanged benchmark checker.
 */
import {readDsn,route,writeSes,layoutStats,requiredConnections} from '../../../../../src/api.ts';
import type {RouteSettings} from '../../../../../spec/types/settings.ts';
import type {RouteDsnResult,RouteHooks} from '../../../../../spec/types/results.ts';
import {recoverRemaining} from '../../recover-remaining.ts';
export function routeDsn(text:string,settings?:Partial<RouteSettings>,hooks?:RouteHooks):RouteDsnResult {
 const read=readDsn(text);if(!read.ok)return {ok:false,error:read.error,diagnostics:read.diagnostics};
 const l=read.layout,statsBefore=layoutStats(l),routeStart=performance.now(),report=route(l,settings,hooks);
 const control={...(report.effectiveSettings.timeBudgetMs===undefined?{}:{deadline:routeStart+report.effectiveSettings.timeBudgetMs}),...(hooks?.signal?{signal:hooks.signal}:{})};
 const available=report.effectiveSettings.maxItems===undefined?16:Math.max(0,Math.min(16,report.effectiveSettings.maxItems-report.added.tracks-report.added.barrels));
 const start=performance.now();
 const recovery=!report.aborted&&!report.timedOut&&available>0?recoverRemaining(l,report.effectiveSettings,true,available,true,control):undefined;
 if(recovery?.status==='aborted'){report.aborted=true;report.stoppedBy='abort';}
 if(recovery?.status==='deadline'){report.timedOut=true;report.stoppedBy='timeBudget';}
 const kept=recovery?.targets.filter(t=>t.status==='kept').length??0;
 report.attempted+=recovery?.targets.length??0;report.completed+=kept;report.added.tracks+=kept;
 const ignored=new Set(l.netGroups.filter(g=>report.effectiveSettings.ignoreNetGroups.includes(g.name)).flatMap(g=>g.nets));
 const pending=requiredConnections(l).filter(c=>!ignored.has(c.net));
 report.incompleteAfter=pending.length;
 report.perNet=report.perNet.map(entry=>({...entry,incomplete:pending.filter(c=>l.nets.find(n=>n.id===c.net)?.name===entry.net).length}));
 if(!report.aborted&&!report.timedOut&&pending.length===0)report.stoppedBy='complete';
 report.wallClockMs+=performance.now()-start;
 return {ok:true,ses:writeSes(l),report,statsBefore,statsAfter:layoutStats(l),diagnostics:[...read.diagnostics,{level:'info',code:'research-local-recovery',message:JSON.stringify(recovery??{status:'normal-budget-stop'})}]};
}
