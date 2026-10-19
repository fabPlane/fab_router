/** Research-only transaction gate; not called by production routing.
 * Proposals must mutate copper only through the supplied Journal. No settings or
 * rule relaxation is performed here. Local search and budget integration are pending.
 */
import type {Layout,Pour} from '../../../spec/types/layout.ts';
import type {Lattice} from '../../../src/lattice/index.ts';
import type {Journal} from '../../../src/route/journal.ts';
import {connectivity} from '../../../src/drc/connect.ts';
import {checkDrc} from '../../../src/api.ts';

export function tryRecoveryTransaction(
 layout:Layout,lattice:Lattice,journal:Journal,
 target:{net:number;from:number;to:number},propose:()=>void,
):'kept'|'retained'|'drc'|'terminals'|'open' {
 if(checkDrc(layout).counts.violations)throw Error('Recovery requires a clean exact-DRC baseline');
 const before=connectivity(layout,lattice);
 const a=before.items.get(target.from),b=before.items.get(target.to);
 if(!a||!b||a.net!==target.net||b.net!==target.net)throw Error('Invalid recovery target');
 const same=(c:ReturnType<typeof connectivity>,x:number,y:number)=>
  c.items.has(x)&&c.items.has(y)&&c.items.get(x)!.net===c.items.get(y)!.net&&c.componentOf.get(x)===c.componentOf.get(y);
 if(same(before,target.from,target.to))throw Error('Recovery target is already joined');
 // Preserve every previously connected terminal, including ignored nets and pours.
 const groups=before.nets.flatMap(n=>n.terminal.map(i=>n.components[i]!.filter(id=>{
  const it=before.items.get(id)!;
  return it.cat==='pad'||(it.cat==='pour'&&(it.ref as Pour).origin!=='prior');
 })));
 // Ignore array order: Journal rewind re-appends removed items. Compare complete
 // retained objects by id, including file/session/prior tracks and barrels.
 const retained=()=>JSON.stringify([layout.tracks,layout.barrels].map(items=>
  items.filter(i=>i.origin!=='router').slice().sort((a,b)=>a.id-b.id)));
 const retainedBefore=retained();
 const mark=journal.mark();let kept=false;
 try {
  propose();
  if(retained()!==retainedBefore)return 'retained';
  if(checkDrc(layout).counts.violations)return 'drc';
  const after=connectivity(layout,lattice);
  if(groups.some(g=>g.some(id=>!same(after,g[0]!,id))))return 'terminals';
  if(!same(after,target.from,target.to))return 'open';
  kept=true;return 'kept';
 } finally {
  if(!kept)journal.rewind(mark);
 }
}
