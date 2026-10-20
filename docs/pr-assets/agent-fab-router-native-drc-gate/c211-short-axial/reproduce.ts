import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
const [repo,root]=process.argv.slice(2);
if(!repo||!root)throw Error('Usage: bun reproduce.ts REPO NEW_DIRECTORY');
await mkdir(root);
const fixture=join(repo,'test/fixtures/native-aquarius-thermal');
const source=gunzipSync(await readFile(join(fixture,'axial-input.kicad_pcb.gz'))).toString();
const added=await readFile(join(fixture,'backbone-added.sexpr'),'utf8');
const end=source.lastIndexOf(')');
for(const [name,text]of [['input',source],['routed',source.slice(0,end)+'\n'+added+'\n'+source.slice(end)]]){
 await writeFile(join(root,name+'.kicad_pcb'),text!);
 for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(root,name+ext),await readFile(join(fixture,'board'+ext)));
}
const {searchNativeThermals}=await import(join(repo,'tools/native-thermal-search.ts'));
const result=await searchNativeThermals(join(root,'input.kicad_pcb'),join(root,'routed.kicad_pcb'),join(root,'accepted.json'),join(root,'search'),1);
console.log(JSON.stringify(result,null,2));
