/** Read-only graph census. No search, journal insertion, or rule changes. */
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
import {copperWithinRegion} from '../../../../src/route/recovery-transaction.ts';
import type {Pt,Box} from '../../../../spec/types/layout.ts';
const [native,out]=process.argv.slice(2);if(!native||!out||existsSync(out))throw Error('NATIVE_RUN UNUSED_JSON');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const rows:any[]=[],skips:any[]=[];
const inputs=JSON.parse(readFileSync(resolve(native,'results.json'),'utf8')).filter((r:any)=>r.seed===1&&r.opens>0&&r.opens<=10);
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
  for(const m of [0,4,8,16,32,64])for(const sheet of profile.sheets.filter(s=>from.sheets.includes(s)&&to.sheets.includes(s))){
   const r={x0:Math.min(from.at.x,to.at.x)-m*pitch,y0:Math.min(from.at.y,to.at.y)-m*pitch,x1:Math.max(from.at.x,to.at.x)+m*pitch,y1:Math.max(from.at.y,to.at.y)+m*pitch};
   const nodes:Pt[]=[{...from.at},{...to.at}],keys=new Set(nodes.map(p=>`${p.x},${p.y}`)),allKeys=new Set(keys);
   const counts:any={pad:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0},track:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0},barrel:{attempted:0,outside:0,duplicate:0,retained:0,excluded:0}};
   const add=(p:Pt,kind:string)=>{const c=counts[kind];c.attempted++;
    if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x-h<r.x0||p.x+h>r.x1||p.y-h<r.y0||p.y+h>r.y1){c.outside++;return;}
    const key=`${p.x},${p.y}`;if(allKeys.has(key)){c.duplicate++;return;}allKeys.add(key);
    if(nodes.length<512){keys.add(key);nodes.push(p);c.retained++;}else c.excluded++;
   };
   for(const pad of l.pads){if(pad.net===target.net)continue;const b=padBoundsOn(l,pad,sheet);if(!b)continue;for(const x of [b.x0-margin,b.x1+margin])for(const y of [b.y0-margin,b.y1+margin])add({x,y},'pad');}
   const corners=(b:Box,extra:number,kind:string)=>{for(const x of [Math.floor(b.x0-extra),Math.ceil(b.x1+extra)])for(const y of [Math.floor(b.y0-extra),Math.ceil(b.y1+extra)])add({x,y},kind);};
   for(const track of l.tracks){if(track.net===target.net||track.sheet!==sheet)continue;for(let i=1;i<track.pts.length;i++){const a=track.pts[i-1]!,b=track.pts[i]!;corners({x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)},margin+track.width/2,'track');}}
   for(const barrel of l.barrels){if(barrel.net===target.net)continue;const b=barrelBoundsOn(l,barrel,sheet);if(b)corners(b,margin,'barrel');}
   // Repeated excluded coordinates never enter production's dedup set. Unique
   // excluded counts here deliberately describe coverage, not charged work.
   const clear=(a:Pt,b:Pt)=>{const leg=legaliseTrail(l,lattice,sheet,[a,b],profile,ignoreOf(target.net),false);return leg.ok&&copperWithinRegion(l,{id:-1,net:target.net,sheet,pts:leg.pts,width:profile.width,kind:profile.trackKind,hold:'free'},r);};
   const exits=nodes.slice(2).filter(p=>clear(nodes[0]!,p)).length,entries=nodes.slice(2).filter(p=>clear(p,nodes[1]!)).length;
   rows.push({case:input.case,target,margin:m,sheet,region:r,nodes:nodes.length,nodeSha256:sha(JSON.stringify(nodes)),counts,exits,entries,direct:clear(nodes[0]!,nodes[1]!),dsnSha256:sha(dsn),sesSha256:sha(ses)});
  }
 }
 if(writeSes(l)!==before||JSON.stringify(l)!==geometry||checkDrc(l).counts.violations)throw Error('Read-only invariant');
 console.log(JSON.stringify({case:input.case,targets:targets.length,rows:rows.length,unchanged:true}));
}
writeFileSync(out,JSON.stringify({scope:'Read-only candidate census, not search or native benchmark; per-sheet regions may not be reached within production budget',rows,skips},null,2)+'\n');
