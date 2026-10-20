import {resolve,join} from 'node:path';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
const {checkNativeBoards}=await import(resolve('tools/native-drc-gate.ts'));
const root=process.argv[2]!,fixture=resolve('test/fixtures/native-aquarius-thermal');await mkdir(root,{recursive:true});
const bytes=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz'))),source=bytes.toString(),end=source.lastIndexOf(')');
const added=await readFile(join(fixture,'thermal55-added.sexpr'),'utf8');
for(const [name,copper] of [['input',''],['candidate',added]]){
 await writeFile(join(root,name+'.kicad_pcb'),name==='input'?bytes:source.slice(0,end)+copper+'\n'+source.slice(end));
 for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(root,name+ext),await readFile(join(fixture,'board'+ext)));
}
const rows=[];for(let repeat=0;repeat<3;repeat++)for(const name of ['input','candidate']){
 const checked=await checkNativeBoards(join(root,'input.kicad_pcb'),join(root,name+'.kicad_pcb'));
 await writeFile(join(root,`${name}-${repeat}.json`),JSON.stringify(checked,null,2));
 const row={name,repeat,errors:checked.newErrors.map(e=>e.type),opens:checked.opensAfter,lostSource:checked.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted};rows.push(row);console.log(row);
}await writeFile(join(root,'results.json'),JSON.stringify(rows,null,2));
