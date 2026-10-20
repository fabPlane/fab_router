import {resolve,join} from 'node:path';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
const root=process.argv[2]!,fixture=resolve('test/fixtures/native-aquarius-thermal');await mkdir(root,{recursive:true});
const source=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz'))).toString();const end=source.lastIndexOf(')');
const before=gunzipSync(await readFile(join(fixture,'full-added.sexpr.gz'))).toString();
const after=before.split('\n').map(line=>line.replaceAll('162.9939 50.8553','162.8939 50.9553').replaceAll('162.3543 48.764','162.2343 48.764').replaceAll('162.3543 51.5768','162.2343 51.5768')).join('\n');
for(const [name,added] of [['input',''],['routed',before],['candidate',after]]){
 await writeFile(join(root,name+'.kicad_pcb'),source.slice(0,end)+added+'\n'+source.slice(end));
 for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(root,name+ext),await readFile(join(fixture,'board'+ext)));
}
const rows=[];for(let repeat=0;repeat<3;repeat++)for(const name of ['routed','candidate']){
 const checked=await checkNativeRepair(join(root,'input.kicad_pcb'),join(root,'routed.kicad_pcb'),join(root,name+'.kicad_pcb'));
 await writeFile(join(root,`${name}-${repeat}.json`),JSON.stringify(checked,null,2));
 const row={name,repeat,errors:checked.newErrors.map(e=>e.type),opens:checked.opensAfter,lostSource:checked.lostTerminalPairs,lostRouted:checked.repair?.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted,repairAccepted:checked.repair?.accepted};rows.push(row);console.log(row);
}await writeFile(join(root,'results.json'),JSON.stringify(rows,null,2));
