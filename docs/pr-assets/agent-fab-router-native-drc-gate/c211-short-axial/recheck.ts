import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const [repo,root]=process.argv.slice(2);if(!repo||!root)throw Error('REPO ROOT required');
const {checkNativeRepair}=await import(join(repo,'tools/native-drc-gate.ts'));
const dir=join(root,'paired');await mkdir(dir);
for(const [name,path]of [['input','after/search/input/board'],['routed','after/search/routed/board'],['candidate','after/search/stage-0/096']]){
 await copyFile(join(root,path+'.kicad_pcb'),join(dir,name+'.kicad_pcb'));
 for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(root,'after/search/input/board'+ext),join(dir,name+ext));
}
const rows=[];
for(let repeat=0;repeat<3;repeat++)for(const [label,board]of [['before','routed'],['after','candidate']]){
 const d=await checkNativeRepair(join(dir,'input.kicad_pcb'),join(dir,'routed.kicad_pcb'),join(dir,board+'.kicad_pcb'));
 await writeFile(join(dir,`${label}-${repeat}.json`),JSON.stringify(d,null,2)+'\n');
 const row={label,repeat,accepted:d.accepted,errors:d.newErrors.map((e:{type:string})=>e.type),opens:d.opensAfter,lostSource:d.lostTerminalPairs,lostRouted:d.repair?.lostTerminalPairs,owned:d.nativeCopperChecks};
 rows.push(row);console.log(JSON.stringify(row));await writeFile(join(root,'paired-summary.json'),JSON.stringify(rows,null,2)+'\n');
 if(d.accepted!==(label==='after')||d.opensAfter!==109||d.lostTerminalPairs!==0||d.repair?.lostTerminalPairs!==0||!d.nativeCopperChecks.every(Boolean))throw Error('Unexpected paired result');
}
