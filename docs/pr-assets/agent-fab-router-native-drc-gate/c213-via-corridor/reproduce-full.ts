import {resolve} from 'node:path';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
import {mkdir,writeFile,readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {join} from 'node:path';
const root=process.argv[2]!, fixture=resolve('test/fixtures/native-aquarius-thermal');await mkdir(root,{recursive:true});await mkdir(join(root,'recheck-normalized'));
const full=gunzipSync(await readFile(join(fixture,'full-added.sexpr.gz'))).toString();
const moved=full.split('\n').map(line => /4b84d5e5-8657-4f74-8744-5c2c8e222717|7d0798d2-5116-47de-bb3e-6a205c90aada|91a393b1-29a4-4ef2-9c1f-7f0332507216|c6d2ef2f-bd0f-4f8a-b251-61b77777f45d|eb9b7055-6d22-44fd-bd92-8da89c423a7c/.test(line) ? line.replaceAll('163.3455 51.5585','163.2455 51.6585').replaceAll('162.9939 50.8553','162.8939 50.9553') : line).join('\n');
const source=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz'))).toString();const end=source.lastIndexOf(')');
for(const [name,added] of [['input',''],['routed',full],['candidate',moved]]){
 await writeFile(join(root,'recheck-normalized',name+'.kicad_pcb'),source.slice(0,end)+added+'\n'+source.slice(end));
 for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(root,'recheck-normalized',name+ext),await readFile(join(fixture,'board'+ext)));
}
const rows=[];for(let repeat=0;repeat<3;repeat++)for(const name of ['routed','candidate']){
 const checked=await checkNativeRepair(join(root,'recheck-normalized/input.kicad_pcb'),join(root,'recheck-normalized/routed.kicad_pcb'),join(root,'recheck-normalized',name+'.kicad_pcb'));
 await writeFile(join(root,'recheck-normalized',`${name}-${repeat}.json`),JSON.stringify(checked,null,2));
 const row={name,repeat,errors:checked.newErrors.map(e=>e.type),opens:checked.opensAfter,lostSource:checked.lostTerminalPairs,lostRouted:checked.repair?.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted,repairAccepted:checked.repair?.accepted};rows.push(row);console.log(row);
}await writeFile(join(root,'recheck-normalized-results.json'),JSON.stringify(rows,null,2));
