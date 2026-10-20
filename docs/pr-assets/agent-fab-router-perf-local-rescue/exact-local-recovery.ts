/** Opt-in research runner only: no change to the public router or its defaults.
 * Local, gradual finer search with exact angle-shaped edges; no rule/width/via relaxation.
 * taskset -c 12-19 nice -n 10 timeout 600 bun <this-file> UNUSED_OUTPUT
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,checkDrc,writeSes} from '../../../src/api.ts';
import {resolveSettings} from '../../../src/pipeline/index.ts';
import {buildLattice} from '../../../src/lattice/index.ts';
import {createJournal} from '../../../src/route/journal.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {createQuilt} from '../../../src/route/quilt.ts';
import {ignoreOf} from '../../../src/route/clear.ts';
import {legaliseTrail} from '../../../src/route/legalise.ts';
import {pullPath} from '../../../src/route/pull.ts';
import {sweepClear} from '../../../src/route/clear.ts';
import {aStar,DIRS_8} from '../../../src/route/search.ts';
import type {Pt} from '../../../src/geom/index.ts';
import type {RouteSettings} from '../../../spec/types/settings.ts';
const [output,context='reduced',mode='exact-keep']=process.argv.slice(2);if(!output||existsSync(output)||!['reduced','original'].includes(context)||!['exact-keep','exact-pull','node-keep','node-pull'].includes(mode))throw Error('Expected UNUSED_OUTPUT [reduced|original] [exact-keep|exact-pull|node-keep|node-pull]');
const fixture=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')) as {input_sha256:string;kept:number[];settings:Partial<RouteSettings>};
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(input)!==fixture.input_sha256)throw Error('Input changed');
const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const parsed=readDsn(input);if(!parsed.ok)throw Error('parse');const l=parsed.layout,target=4;
 if(context==='reduced')l.pads=l.pads.filter(p=>fixture.kept.includes(p.id));l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>fixture.kept.includes(id))}));
 const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1;
 l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
 l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
 const settings=resolveSettings({...fixture.settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)},undefined,l.angleMode);
 const retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels,pours:l.pours});
 const began=performance.now(),report=route(l,settings),normalSeconds=(performance.now()-began)/1000;
 const before=requiredConnections(l).filter(c=>c.net===target),sesBefore=writeSes(l);
 if(before.length!==1||before[0]!.from!==10||before[0]!.to!==62||checkDrc(l).counts.violations||report.aborted||report.timedOut)throw Error('Control changed');
 const lattice=buildLattice(l),journal=createJournal(l,lattice),profile=resolveProfile(l,target,settings),ignore=ignoreOf(target);
 const pitch=profile.width+profile.maxSpacing,trials=[];let closed=false;
 const recoveryStart=performance.now();
 outer:for(const marginPitches of [4,8])for(const div of [2,4,8,16])for(const reverse of [false,true]){
  const from=l.pads.find(p=>p.id===(reverse?62:10))!,to=l.pads.find(p=>p.id===(reverse?10:62))!;
  for(const sheet of from.sheets.filter(s=>to.sheets.includes(s)&&profile.sheets.includes(s))){
   const step=Math.max(1,Math.floor(pitch/div)),q=createQuilt(l,lattice,sheet,profile,from.at,step,{ignore});
   const margin=marginPitches*pitch,region={gx0:Math.floor((Math.min(from.at.x,to.at.x)-margin-from.at.x)/step),gx1:Math.ceil((Math.max(from.at.x,to.at.x)+margin-from.at.x)/step),gy0:Math.floor((Math.min(from.at.y,to.at.y)-margin-from.at.y)/step),gy1:Math.ceil((Math.max(from.at.y,to.at.y)+margin-from.at.y)/step)};
   const start=performance.now(),deadline=Date.now()+15000;
   const edge=(a:Pt,b:Pt)=>legaliseTrail(l,lattice,sheet,[a,b],profile,ignore,false);
   const res=aStar({step,pointOf:q.pointOf,nodeFree:q.isFree,edgeCost:(a,b)=>({blocked:mode.startsWith('node-')?false:!edge(a,b).ok,extra:0,rip:[]})},{start:{gx:0,gy:0},goal:q.cellOf(to.at),region,dirs:DIRS_8,stepCost:()=>1,minCost:1,bendCost:0,maxPops:60000,deadline});
   const mark=journal.mark();let inserted=false,wholeLegal=false,rawWholeLegal=false,pathPoints=0;let candidate:Pt[]=[],rawPath:Pt[]=[],pulledPath:Pt[]=[];
   if(res.ok){
    const raw=[...res.path,to.at];rawPath=raw;pulledPath=pullPath(raw,(a,b)=>sweepClear(l,lattice,sheet,{a,b},profile,ignore,profile.width).ok);
    const path=mode.endsWith('-pull')?pullPath(raw,(a,b)=>sweepClear(l,lattice,sheet,{a,b},profile,ignore,profile.width).ok):raw;
    wholeLegal=legaliseTrail(l,lattice,sheet,path,profile,ignore,false).ok;rawWholeLegal=legaliseTrail(l,lattice,sheet,raw,profile,ignore,false).ok;pathPoints=path.length;
    const pts:Pt[]=[path[0]!];let legal=true;
    for(let i=1;i<path.length;i++){
     const a=path[i-1]!,b=path[i]!;if(a.x===b.x&&a.y===b.y)continue;
     const leg=edge(a,b);if(!leg.ok){legal=false;break;}pts.push(...leg.pts.slice(1));
    }
    candidate=pts;
    if(legal&&pts.length>1){journal.addTrack({net:target,sheet,pts,width:profile.width,kind:profile.trackKind,hold:'free'});inserted=true;}
   }
   const violations=inserted?checkDrc(l).counts.violations:0,left=requiredConnections(l).filter(c=>c.net===target).length;
   closed=inserted&&violations===0&&left===0;
   if(!closed){journal.rewind(mark);if(writeSes(l)!==sesBefore)throw Error('Rollback changed session');}
   const row={marginPitches,div,reverse,sheet,step,region,searchOk:res.ok,pops:res.pops,aborted:res.aborted,deadlineExpired:Date.now()>deadline,inserted,wholeLegal,rawWholeLegal,pathPoints,rawPath,pulledPath,candidate,violations,left,closed,seconds:(performance.now()-start)/1000};
   trials.push(row);console.log(JSON.stringify({repeat,...row}));if(closed||mode!=='exact-keep')break outer;
  }
 }
 if(JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.origin!=='router'),barrels:l.barrels.filter(b=>b.origin!=='router'),pours:l.pours})!==retained)throw Error('Retained copper changed');
 if(checkDrc(l).counts.violations)throw Error('Final DRC');
 rows.push({repeat,normalSeconds,recoverySeconds:(performance.now()-recoveryStart)/1000,before,report,profile,closed,trials,sesBeforeSha256:hash(sesBefore),sesAfterSha256:hash(writeSes(l)),tracks:l.tracks.filter(t=>t.origin==='router'),pads:l.pads.map(p=>({id:p.id,at:p.at,net:p.net}))});
}
writeFileSync(output,JSON.stringify({scope:'Reduced-fixture engine experiment only. Exact real profile; no native DRC or full-board improvement claim.',inputSha256:hash(input),context,mode,rows},null,2)+'\n');
