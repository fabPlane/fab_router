import { assertSourcePads } from './source-pad-inventory.ts';
const rows=[];
for(const [phase,root] of [['before',process.argv[2]!],['after',process.argv[3]!] ] as const){
 const results=await Bun.file(`${root}/results.json`).json();if(results.length!==78)throw Error('Incomplete run');
 for(const r of results){let error:string|null=null;try{assertSourcePads(await Bun.file(`${root}/${r.evidence}/work/board.kicad_pcb`).text(),await Bun.file(`${root}/${r.evidence}/final.kicad_pcb`).text())}catch(e){error=String(e)}rows.push({phase,case:r.case,seed:r.seed,preserved:error===null,error})}
}
const counts=Object.fromEntries(['before','after'].map(p=>[p,{preserved:rows.filter(r=>r.phase===p&&r.preserved).length,rejected:rows.filter(r=>r.phase===p&&!r.preserved).length}]));
await Bun.write(process.argv[4]!,JSON.stringify({counts,rows},null,2)+'\n');console.log(JSON.stringify(counts));
if(counts.before!.rejected!==12||counts.after!.rejected!==0)throw Error('Unexpected preservation result');
