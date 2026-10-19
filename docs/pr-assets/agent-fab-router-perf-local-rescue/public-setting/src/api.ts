/** Benchmark entry point: enable the actual public setting, with no routing implementation here. */
import {routeDsn as publicRouteDsn} from '../../../../../src/api.ts';
import type {RouteSettings} from '../../../../../spec/types/settings.ts';
import type {RouteHooks} from '../../../../../spec/types/results.ts';
export function routeDsn(text:string,settings?:Partial<RouteSettings>,hooks?:RouteHooks){
 return publicRouteDsn(text,{...settings,localRecovery:true},hooks);
}
