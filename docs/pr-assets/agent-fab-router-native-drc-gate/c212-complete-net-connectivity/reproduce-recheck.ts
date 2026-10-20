import { checkNativeBoards } from './runtime-tools/native-drc-gate.ts';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
const root=process.argv[2]!;
const fixture=join(process.cwd(),'test/fixtures/native-aquarius-thermal');
const source=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz'))).toString();
const end=source.lastIndexOf(')');
const full=gunzipSync(await readFile(join(fixture,'full-added.sexpr.gz'))).toString();
const selected=await readFile(join(root,'minimized/selected.sexpr'),'utf8');
const rows=[];
for(const [name,added] of [['source',''],['full',full],['complete-net',selected]]) for(let repeat=0;repeat<3;repeat++){
 const out=join(root,'recheck',`${name}-${repeat}`);await mkdir(out,{recursive:true});
 for(const stem of ['input','candidate']){
  await writeFile(join(out,`${stem}.kicad_pcb`),stem==='input'?source:source.slice(0,end)+'\n'+added+'\n'+source.slice(end));
  for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(fixture,'board'+ext),join(out,stem+ext));
 }
 const result=await checkNativeBoards(join(out,'input.kicad_pcb'),join(out,'candidate.kicad_pcb'));
 await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 const row={name,repeat,errors:result.newErrors.map(x=>x.type),opens:result.opensAfter,lostPairs:result.lostTerminalPairs,accepted:result.accepted,nativeCopperPreserved:result.nativeCopperPreserved};
 rows.push(row);await writeFile(join(root,'recheck-results.json'),JSON.stringify(rows,null,2)+'\n');console.log(row);
}
