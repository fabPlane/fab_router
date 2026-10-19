/** Normal-pipeline observer control. No recovery copper is proposed or inserted. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [source,output,context]=process.argv.slice(2);
if(!source||!output||existsSync(output)||!['reduced','original'].includes(context!))throw Error('Expected SOURCE UNUSED_OUTPUT reduced|original');
const {readDsn,route,requiredConnections,checkDrc,writeSes,layoutStats}=await import(`${source}/src/api.ts`);
const input=readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8'));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(input)!==fixture.input_sha256)throw Error('input changed');
const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const parsed=readDsn(input);if(!parsed.ok)throw Error('parse');const l=parsed.layout,target=4;
 if(context==='reduced')l.pads=l.pads.filter((p:{id:number})=>fixture.kept.includes(p.id));
 l.nets=l.nets.map((n:any)=>({...n,pads:n.pads.filter((id:number)=>fixture.kept.includes(id))}));
 const groups=l.netGroups,offset=Math.max(...groups.map((g:any)=>g.id))+1;
 l.netGroups=[...groups.map((g:any)=>({...g,nets:g.nets.filter((n:number)=>n===target)})),...groups.map((g:any)=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter((n:number)=>n!==target)}))];
 l.nets=l.nets.map((n:any)=>n.id===target?n:{...n,group:n.group+offset});
 const retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels,pours:l.pours});
 console.log('NORMAL_BEGIN '+JSON.stringify({context,repeat}));
 const start=performance.now(),report=route(l,{...fixture.settings,ignoreNetGroups:groups.map((g:any)=>`isolation-ignore-${g.id}`)});
 const row={stats:layoutStats(l),routerTracks:l.tracks.filter((t:any)=>t.origin==='router'),repeat,seconds:(performance.now()-start)/1000,left:requiredConnections(l).filter((c:any)=>c.net===target),violations:checkDrc(l).counts.violations,session:hash(writeSes(l)),aborted:report.aborted,timedOut:report.timedOut};
 if(!row.left.every((c:any)=>c.from===10&&c.to===62))throw Error('short branch disconnected');
 if(row.violations||row.aborted||row.timedOut||row.left.length>1)throw Error('control changed');
 if(JSON.stringify({pads:l.pads,tracks:l.tracks.filter((t:any)=>t.origin!=='router'),barrels:l.barrels.filter((b:any)=>b.origin!=='router'),pours:l.pours})!==retained)throw Error('retained changed');
 rows.push(row);console.log('NORMAL_END '+JSON.stringify(row));
}
writeFileSync(output,JSON.stringify({context,input_sha256:hash(input),rows},null,2)+'\n',{flag:'wx'});
