/** Point anchors supported by insertion-only recovery. Pours need a geometric
 * attachment search; their ids must never be interpreted as pad or barrel ids.
 */
import type {Layout,Pt} from '../../spec/types/layout.ts';
import {barrelSheets} from '../lattice/index.ts';

export function recoveryEndpoint(layout:Layout,id:number,net:number):{id:number;at:Pt;sheets:readonly number[]}|undefined {
 const pad=layout.pads.find(p=>p.id===id&&p.net===net);
 if(pad)return {id:pad.id,at:pad.at,sheets:pad.sheets};
 const barrel=layout.barrels.find(b=>b.id===id&&b.net===net);
 if(barrel)return {id:barrel.id,at:barrel.at,sheets:barrelSheets(layout,barrel)};
 return undefined;
}
