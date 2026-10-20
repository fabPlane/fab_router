/** Read-only per-kind, per-sheet candidate inflation diagnostic. Read-only diagnostic. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readDsn,applySes,writeSes,checkDrc,requiredConnections} from '../../../../src/api.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {buildLattice,padBoundsOn,barrelBoundsOn} from '../../../../src/lattice/index.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {recoveryEndpoint} from '../../../../src/route/recovery-endpoint.ts';
import {legaliseTrail} from '../../../../src/route/legalise.ts';
import {ignoreOf} from '../../../../src/route/clear.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {tryRecoveryTransaction} from '../../../../src/route/recovery-transaction.ts';
import {copperWithinRegion} from '../../../../src/route/recovery-transaction.ts';
import type {Pt,Box} from '../../../../spec/types/layout.ts';
const [native,out,mode]=process.argv.slice(2);if(!["corners","kind-spacing"].includes(mode))throw Error("MODE");if(!native||!out||existsSync(out))throw Error('NATIVE_RUN UNUSED_JSON');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const rows:any[]=[],skips:any[]=[];
const inputs=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8')).filter((r:any)=>r.seed===1&&r.case.includes("paperino")&&r.opens>0&&r.opens<=10);
for(const input of inputs){
 const work=resolve(native,input.evidence,'work'),dsn=readFileSync(resolve(work,'board.dsn'),'utf8'),ses=readFileSync(resolve(work,'board.ses'),'utf8');
 const parsed=readDsn(dsn);if(!parsed.ok)throw Error('Parse');const l=parsed.layout;if(!applySes(l,ses).ok)throw Error('Session');
 if(checkDrc(l).counts.violations)throw Error('Nonzero exact baseline');
 const before=writeSes(l),geometry=JSON.stringify(l),targets=requiredConnections(l),lattice=buildLattice(l);
 const summary=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8'));
 const settings=resolveSettings(summary.result.report.effectiveSettings,undefined,l.angleMode);
 if(!targets.length)skips.push({case:input.case,nativeOpens:input.opens,reason:'no engine residual after import'});
 for(const target of targets){
  const from=recoveryEndpoint(l,target.from,target.net),to=recoveryEndpoint(l,target.to,target.net);
  if(!from||!to){skips.push({case:input.case,target,reason:'unsupported point pair'});continue;}
  const profile=resolveProfile(l,target.net,settings),pitch=profile.width+profile.maxSpacing,h=profile.halfWidth,margin=Math.ceil(profile.maxSpacing+h)+1;
  for(const m of [64])for(const sheet of profile.sheets.filter(s=>from.sheets.includes(s)&&to.sheets.includes(s))){
   const r={x0:Math.min(from.at.x,to.at.x)-m*pitch,y0:Math.min(from.at.y,to.at.y)-m*pitch,x1:Math.max(from.at.x,to.at.x)+m*pitch,y1:Math.max(from.at.y,to.at.y)+m*pitch};
   const spacingSamples:any[]=[];
   const offset=(kind:number)=>{const actual=l.spacing.get(profile.trackKind,kind,sheet);const exactMargin=Math.ceil(actual+h)+1;spacingSamples.push({kind,sheet,actual,maxSpacing:profile.maxSpacing,globalMargin:margin,exactMargin});return mode==='kind-spacing'?exactMargin:margin;};
   const midpointCandidates:Pt[]=[];
   const midpoints=(b:Box,extra:number)=>{const x0=Math.floor(b.x0-extra),x1=Math.ceil(b.x1+extra),y0=Math.floor(b.y0-extra),y1=Math.ceil(b.y1+extra),x=Math.round((x0+x1)/2),y=Math.round((y0+y1)/2);midpointCandidates.push({x:x0,y},{x:x1,y},{x,y:y0},{x,y:y1});};
   const nodes:Pt[]=[{...from.at},{...to.at}],keys=new Set(nodes.map(p=>`${p.x},${p.y}`)),allKeys=new Set(keys);
   const counts:any={midpoint:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0},pad:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0},track:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0},barrel:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0}};
   const add=(p:Pt,kind:string)=>{const c=counts[kind];c.attempted++;
    if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x-h<r.x0||p.x+h>r.x1||p.y-h<r.y0||p.y+h>r.y1){c.outside++;return;}
    const key=`${p.x},${p.y}`;if(allKeys.has(key)){c.duplicate++;return;}allKeys.add(key);
    if(nodes.length<512){keys.add(key);nodes.push(p);c.retained++;}else c.excluded++;
   };
   for(const pad of l.pads){if(pad.net===target.net)continue;const b=padBoundsOn(l,pad,sheet);if(!b)continue;const extra=offset(pad.kind);midpoints(b,extra);for(const x of [b.x0-extra,b.x1+extra])for(const y of [b.y0-extra,b.y1+extra])add({x,y},'pad');}
   const corners=(b:Box,extra:number,kind:string)=>{midpoints(b,extra);for(const x of [Math.floor(b.x0-extra),Math.ceil(b.x1+extra)])for(const y of [Math.floor(b.y0-extra),Math.ceil(b.y1+extra)])add({x,y},kind);};
   for(const track of l.tracks){if(track.net===target.net||track.sheet!==sheet)continue;for(let i=1;i<track.pts.length;i++){const a=track.pts[i-1]!,b=track.pts[i]!;corners({x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)},offset(track.kind)+track.width/2,'track');}}
   for(const barrel of l.barrels){if(barrel.net===target.net)continue;const b=barrelBoundsOn(l,barrel,sheet);if(b)corners(b,offset(barrel.kind),'barrel');}
   // Repeated excluded coordinates never enter production's dedup set. Unique
   // excluded counts here deliberately describe coverage, not charged work.
   const clear=(a:Pt,b:Pt)=>{const leg=legaliseTrail(l,lattice,sheet,[a,b],profile,ignoreOf(target.net),false);return leg.ok&&copperWithinRegion(l,{id:-1,net:target.net,sheet,pts:leg.pts,width:profile.width,kind:profile.trackKind,hold:'free'},r);};
   if(Object.values(counts).some((c:any)=>c.excluded))throw Error('Capped graph');
   const cornerCount=nodes.length;
   
   const parents=new Map<number,{prev:number;pts:Pt[]}>();
   const adjacency:number[][]=nodes.map(()=>[]);let edgeChecks=0,exhausted=false;
   const seen=new Set<number>([0]),queue=[0];
   search:for(let k=0;k<queue.length;k++)for(let j=0;j<nodes.length;j++){
    const i=queue[k]!;if(i===j||seen.has(j))continue;
    if(edgeChecks===100000){exhausted=true;break search;}
    edgeChecks++;if(clear(nodes[i]!,nodes[j]!)){const leg=legaliseTrail(l,lattice,sheet,[nodes[i]!,nodes[j]!],profile,ignoreOf(target.net),false);if(!leg.ok)throw Error('Replay edge');parents.set(j,{prev:i,pts:leg.pts});adjacency[i]!.push(j);seen.add(j);queue.push(j);}
   }
   let proposal:any=null;
   if(seen.has(1)){
    const legs:Pt[][]=[];let id=1;while(id!==0){const edge=parents.get(id);if(!edge)throw Error('Missing parent');legs.push(edge.pts);id=edge.prev;}
    const pts=legs.reverse().flatMap((leg,i)=>i?leg.slice(1):leg);
    // Isolated reconstruction: never mutate the source layout or affect later targets.
    const copy=readDsn(dsn);if(!copy.ok||!applySes(copy.layout,ses).ok)throw Error('Copy');
    const cl=copy.layout,ci=buildLattice(cl),j=createJournal(cl,ci),mark=j.mark(),copyBefore=writeSes(cl);
    const status=tryRecoveryTransaction(cl,ci,j,target,()=>{j.addTrack({net:target.net,sheet,pts,width:profile.width,kind:profile.trackKind,hold:'free'});},r);
    const exactViolations=checkDrc(cl).counts.violations;
    proposal={pts,width:profile.width,kind:profile.trackKind,status,exactViolations,remainingBefore:targets.length,remainingAfter:requiredConnections(cl).length,lengthLu:pts.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-pts[i]!.x,p.y-pts[i]!.y),0)};
    j.rewind(mark);if(writeSes(cl)!==copyBefore||checkDrc(cl).counts.violations)throw Error('Copy rewind');
   }
   const forward=[...seen].sort((a,b)=>a-b),reverse:number[]=[];
   rows.push({case:input.case,target,margin:m,sheet,region:r,nodes,nodeSha256:sha(JSON.stringify(nodes)),mode,proposal,spacingSamples,cornerCount,midpointCandidates:midpointCandidates.length,exhausted,counts,edgeChecks,adjacency,forward,reverse,reachable:forward.includes(1),intersection:forward.filter(i=>reverse.includes(i)),dsnSha256:sha(dsn),sesSha256:sha(ses)});
   console.log(JSON.stringify({case:input.case,target,sheet,nodes:nodes.length,forward:forward.length,reverse:reverse.length,reachable:forward.includes(1)}));
  }
 }
 if(writeSes(l)!==before||JSON.stringify(l)!==geometry||checkDrc(l).counts.violations)throw Error('Read-only invariant');
 console.log(JSON.stringify({case:input.case,targets:targets.length,rows:rows.length,unchanged:true}));
}
writeFileSync(out,JSON.stringify({readOnlyVerified:true,exactViolations:0,scope:'Bounded read-only waypoint coverage; at most512nodes/100000edge checks; not production work accounting or native score',mode,rows,skips},null,2)+'\n');
