"""Disposable multi-witness experiment. No production source changes."""
import hashlib,json,shutil,sys
from pathlib import Path
root,out=map(lambda s:Path(s).resolve(),sys.argv[1:3])
cap=int(sys.argv[3]) if len(sys.argv)>3 else 32
assert cap in (1,32)
if out.exists():raise SystemExit('Output exists')
out.mkdir(parents=True)
for name in ('src','spec'):shutil.copytree(root/name,out/name)
for name in ('package.json','tsconfig.json'):shutil.copy2(root/name,out/name)
(out/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
p=out/'src/route/recovery-endpoint.ts'
s=p.read_text().replace("import {barrelSheets}","import {pourRegion,shapeTouchesPour} from '../drc/pour.ts';\nimport {barrelSheets}")
s=s.replace('net:number):{id:number;at:Pt;sheets:readonly number[]}', 'net:number,toward?:number):{id:number;at:Pt;sheets:readonly number[];witnesses?:Pt[]}')
s=s.replace(' return undefined;', ''' const pour=layout.pours.find(p=>p.id===id&&p.net===net&&p.outline.length>=3);
 if(pour){
  // Explicitly bounded proposal heuristic, not a complete filled-region search.
  // Only the actual other point anchor guides ordering; no unrelated pad centroid.
  const other=layout.pads.find(p=>p.id===toward&&p.net===net)??layout.barrels.find(p=>p.id===toward&&p.net===net);
  if(!other)return undefined; // pour-to-pour remains unsupported
  const region=pourRegion(pour),candidates:Pt[]=[],keys=new Set<string>();
  const add=(p:Pt)=>{
   const q={x:Math.round(p.x),y:Math.round(p.y)},key=`${q.x},${q.y}`;
   if(!Number.isSafeInteger(q.x)||!Number.isSafeInteger(q.y)||keys.has(key))return;
   keys.add(key);
   if(shapeTouchesPour({kind:'disk',c:q,r:0},region))candidates.push(q);
  };
  let inspected=0;
  for(const ring of [pour.outline,...pour.holes]){
   for(let i=0;i<ring.length&&inspected<256;i++,inspected++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!,dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
    const t=d?Math.max(0,Math.min(1,((other.at.x-a.x)*dx+(other.at.y-a.y)*dy)/d)):0;
    add({x:a.x+t*dx,y:a.y+t*dy});add(a);
   }
   if(inspected>=256)break;
  }
  candidates.sort((a,b)=>Math.hypot(a.x-other.at.x,a.y-other.at.y)-Math.hypot(b.x-other.at.x,b.y-other.at.y)||a.x-b.x||a.y-b.y);
  const witnesses=candidates.slice(0,32),at=witnesses[0];
  if(at)return {id:pour.id,at,sheets:[pour.sheet],witnesses};
 }
 return undefined;''')
p.write_text(s.replace('candidates.slice(0,32)',f'candidates.slice(0,{cap})'))
for name in ('recovery-schedule.ts','visibility-recovery.ts','recover-remaining.ts'):
 p=out/'src/route'/name;s=p.read_text()
 for pair in ('target','pair'):
  s=s.replace(f'recoveryEndpoint(layout,{pair}.from,{pair}.net)',f'recoveryEndpoint(layout,{pair}.from,{pair}.net,{pair}.to)')
  s=s.replace(f'recoveryEndpoint(layout,{pair}.to,{pair}.net)',f'recoveryEndpoint(layout,{pair}.to,{pair}.net,{pair}.from)')
 p.write_text(s)
p=out/'src/route/visibility-recovery.ts';s=p.read_text()
s=s.replace('const nodes:Pt[]=[{...from.at},{...to.at}],keys=new Set(nodes.map(p=>`${p.x},${p.y}`));','''const anchors=(e:typeof from)=>e!.witnesses?e!.witnesses.filter(p=>{
   trial.expand();return p.x-profile.halfWidth>=trial.region.x0&&p.x+profile.halfWidth<=trial.region.x1&&p.y-profile.halfWidth>=trial.region.y0&&p.y+profile.halfWidth<=trial.region.y1;
  }):[e!.at];
  const starts=anchors(from),ends=anchors(to);
  if(!starts.length||!ends.length)continue;
  const nodes:Pt[]=[...starts,...ends],keys=new Set(nodes.map(p=>`${p.x},${p.y}`));
  const startIds=new Set(starts.map((_,i)=>i)),endIds=new Set(ends.map((_,i)=>starts.length+i));''')
s=s.replace('costs[0]=0;','for(const id of startIds)costs[id]=0;')
s=s.replace('if(current===1){','if(endIds.has(current)){').replace('const legs:Pt[][]=[];let id=1;','const legs:Pt[][]=[];let id=current;').replace('while(id!==0){','while(!startIds.has(id)){')
p.write_text(s)
def hashes(base):return {str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest()for top in ('src','spec')for p in sorted((base/top).rglob('*'))if p.is_file()}
a,b=hashes(root),hashes(out)
changed=[p for p in a if a[p]!=b[p]]
assert sorted(changed)==sorted(['src/route/'+n for n in ('recovery-endpoint.ts','recovery-schedule.ts','visibility-recovery.ts','recover-remaining.ts')]),changed
(out/'sources.json').write_text(json.dumps({'baseline':a,'candidate':b,'changed':changed,'cap':cap},indent=2)+'\n')
