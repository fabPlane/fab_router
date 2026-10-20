/** Research only. Bounded pad-corner visibility search, no rule/width/grid changes.
 * Every candidate generation, settled node and directed edge charges the shared
 * scheduler budget. Journal insertion happens only after reconstructing the path.
 * Exact edge shaping may bend; all shaped copper must fit the local region.
 * Incomplete heuristic graph: no vias, rip-up, pad-edge attachment or pour nodes.
 */
import type {Layout,Pt} from '../../../spec/types/layout.ts';
import type {Lattice} from '../../../src/lattice/index.ts';
import {padBoundsOn} from '../../../src/lattice/index.ts';
import type {Journal} from '../../../src/route/journal.ts';
import type {Profile} from '../../../src/route/profile.ts';
import {legaliseTrail} from '../../../src/route/legalise.ts';
import {ignoreOf} from '../../../src/route/clear.ts';
import {copperWithinRegion} from './recovery-transaction.ts';
import type {RecoveryTrial} from './recovery-schedule.ts';

export function proposeVisibility(
 layout:Layout,lattice:Lattice,journal:Journal,target:{net:number;from:number;to:number},
 profile:Profile,trial:RecoveryTrial,maxNodes=512,
):{found:boolean;nodes:number;edges:number} {
 if(!Number.isSafeInteger(maxNodes)||maxNodes<2||maxNodes>512)throw Error('Invalid visibility node cap');
 if(profile.net!==target.net||!Number.isFinite(profile.width)||profile.width<=0)throw Error('Invalid visibility profile');
 const from=layout.pads.find(p=>p.id===target.from),to=layout.pads.find(p=>p.id===target.to);
 if(!from||!to||from.net!==target.net||to.net!==target.net)throw Error('Invalid visibility target');
 let totalNodes=0,edges=0;
 for(const sheet of profile.sheets.filter(s=>from.sheets.includes(s)&&to.sheets.includes(s))){
  const nodes:Pt[]=[{...from.at},{...to.at}],keys=new Set(nodes.map(p=>`${p.x},${p.y}`));
  const r=trial.region,h=profile.halfWidth;
  const add=(p:Pt)=>{
   trial.expand();
   if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x-h<r.x0||p.x+h>r.x1||p.y-h<r.y0||p.y+h>r.y1)return;
   const key=`${p.x},${p.y}`;if(!keys.has(key)&&nodes.length<maxNodes){keys.add(key);nodes.push(p);}
  };
  // Corners are a proposal heuristic only: the real sheet/kind clearance is
  // enforced by legaliseTrail, never replaced by this bounding-box offset.
  const margin=Math.ceil(profile.maxSpacing+h)+1;
  for(const pad of layout.pads){
   trial.expand();if(pad.net===target.net)continue;
   const b=padBoundsOn(layout,pad,sheet);if(!b)continue;
   for(const x of [b.x0-margin,b.x1+margin])for(const y of [b.y0-margin,b.y1+margin])add({x,y});
  }
  totalNodes+=nodes.length;
  const costs=nodes.map(()=>Infinity),done=new Set<number>(),parent=new Map<number,{prev:number;pts:Pt[]}>();costs[0]=0;
  while(done.size<nodes.length){
   trial.expand();
   let current=-1,best=Infinity;
   for(let i=0;i<nodes.length;i++)if(!done.has(i)&&costs[i]!<best){current=i;best=costs[i]!;}
   if(current<0)break;
   if(current===1){
    const legs:Pt[][]=[];let id=1;
    while(id!==0){const p=parent.get(id)!;legs.push(p.pts);id=p.prev;}
    const pts=legs.reverse().flatMap((leg,i)=>i?leg.slice(1):leg);
    journal.addTrack({net:target.net,sheet,pts,width:profile.width,kind:profile.trackKind,hold:'free'});
    return {found:true,nodes:totalNodes,edges};
   }
   done.add(current);
   for(let next=0;next<nodes.length;next++){
    if(next===current||done.has(next))continue;
    trial.expand();edges++;
    const leg=legaliseTrail(layout,lattice,sheet,[nodes[current]!,nodes[next]!],profile,ignoreOf(target.net),false);
    if(!leg.ok||!copperWithinRegion(layout,{id:-1,net:target.net,sheet,pts:leg.pts,width:profile.width,kind:profile.trackKind,hold:'free'},r))continue;
    const length=leg.pts.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-leg.pts[i]!.x,p.y-leg.pts[i]!.y),0);
    if(best+length<costs[next]!){costs[next]=best+length;parent.set(next,{prev:current,pts:leg.pts});}
   }
  }
 }
 return {found:false,nodes:totalNodes,edges};
}
