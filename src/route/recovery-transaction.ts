/** Exact transaction gate for the opt-in local recovery post-pass.
 * Proposals must mutate copper only through the supplied Journal. No settings or
 * rule relaxation is performed here. Local search and budget integration are pending.
 */
import type {Layout,Pour,Track,Barrel,Box} from '../../spec/types/layout.ts';
import type {Lattice} from '../lattice/index.ts';
import {barrelBoundsOn,drillOfBarrel,trackLegBounds,trackLegCount} from '../lattice/index.ts';
import type {Journal} from './journal.ts';
import {connectivity} from '../drc/connect.ts';
import {checkDrc} from '../drc/index.ts';

/** Closed XY region on every sheet. Includes full copper radius and drill extent,
 * not just route vertices. A changed item must fit in its entirety; no clipping.
 */
export function copperWithinRegion(layout:Layout,item:Track|Barrel,region:Box):boolean {
 const inside=(b:Box)=>[b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)&&
  region.x0<=b.x0&&region.y0<=b.y0&&b.x1<=region.x1&&b.y1<=region.y1;
 if('pts' in item){
  return item.pts.length>0&&Number.isFinite(item.width)&&item.width>0&&
   Array.from({length:trackLegCount(item)},(_,i)=>trackLegBounds(item,i)).every(inside);
 }
 if(!layout.padForms.some(f=>f.id===item.form))return false;
 let found=false;
 for(const sheet of layout.stack){
  const b=barrelBoundsOn(layout,item,sheet.id);
  if(b){found=true;if(!inside(b))return false;}
 }
 const drill=drillOfBarrel(layout,item);
 if(drill){
  found=true;const {c,r}=drill;
  if(!inside({x0:c.x-r,y0:c.y-r,x1:c.x+r,y1:c.y+r}))return false;
 }
 return found;
}

export function tryRecoveryTransaction(
 layout:Layout,lattice:Lattice,journal:Journal,
 target:{net:number;from:number;to:number},propose:()=>void,region?:Box,checkpoint?:()=>void,
):'kept'|'retained'|'region'|'drc'|'terminals'|'open' {
 if(region&&(![region.x0,region.y0,region.x1,region.y1].every(Number.isFinite)||
  region.x0>region.x1||region.y0>region.y1))throw Error('Invalid recovery region');
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
 // Journal-only callbacks never mutate saved objects. Compare both removed and
 // inserted geometry: testing just the final insertions misses remote rip-up.
 const copper=()=>new Map<number,Track|Barrel>([...layout.tracks,...layout.barrels].map(i=>[i.id,i]));
 const copperBefore=region?copper():undefined;
 const mark=journal.mark();let kept=false;
 try {
  checkpoint?.();
  propose();
  checkpoint?.();
  if(retained()!==retainedBefore)return 'retained';
  if(region&&copperBefore){
   const after=copper();
   for(const id of new Set([...copperBefore.keys(),...after.keys()])){
    const old=copperBefore.get(id),next=after.get(id);
    if(JSON.stringify(old)===JSON.stringify(next))continue;
    if((old&&!copperWithinRegion(layout,old,region))||(next&&!copperWithinRegion(layout,next,region)))return 'region';
   }
  }
  if(checkDrc(layout).counts.violations)return 'drc';
  const after=connectivity(layout,lattice);
  if(groups.some(g=>g.some(id=>!same(after,g[0]!,id))))return 'terminals';
  if(!same(after,target.from,target.to))return 'open';
  // Validation is synchronous: a deadline/abort observed after it still rewinds.
  checkpoint?.();
  kept=true;return 'kept';
 } finally {
  if(!kept)journal.rewind(mark);
 }
}
