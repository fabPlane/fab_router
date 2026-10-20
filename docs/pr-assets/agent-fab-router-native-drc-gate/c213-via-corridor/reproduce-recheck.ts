import {resolve} from 'node:path';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
import {mkdir,writeFile,readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {join} from 'node:path';
const root=process.argv[2]!, fixture=resolve('test/fixtures/native-aquarius-thermal');await mkdir(root,{recursive:true});await mkdir(join(root,'recheck-normalized'));
const source=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz'))).toString();const end=source.lastIndexOf(')');
for(const [name,added] of [['input',''],['routed',await readFile(join(fixture,'connectivity-nets.sexpr'),'utf8')],['candidate',await readFile(join(fixture,'connectivity-via-pair.sexpr'),'utf8')]]){
 await writeFile(join(root,'recheck-normalized',name+'.kicad_pcb'),source.slice(0,end)+added+'\n'+source.slice(end));
 for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(root,'recheck-normalized',name+ext),await readFile(join(fixture,'board'+ext)));
}
const rows=[];for(let repeat=0;repeat<3;repeat++)for(const name of ['routed','candidate']){
 const checked=await checkNativeRepair(join(root,'recheck-normalized/input.kicad_pcb'),join(root,'recheck-normalized/routed.kicad_pcb'),join(root,'recheck-normalized',name+'.kicad_pcb'));
 await writeFile(join(root,'recheck-normalized',`${name}-${repeat}.json`),JSON.stringify(checked,null,2));
 const row={name,repeat,errors:checked.newErrors.map(e=>e.type),opens:checked.opensAfter,lostSource:checked.lostTerminalPairs,lostRouted:checked.repair?.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted,repairAccepted:checked.repair?.accepted};rows.push(row);console.log(row);
}await writeFile(join(root,'recheck-normalized-results.json'),JSON.stringify(rows,null,2));
