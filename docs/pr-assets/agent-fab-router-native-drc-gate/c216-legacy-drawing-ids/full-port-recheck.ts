import {resolve} from 'node:path';import {writeFile} from 'node:fs/promises';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
const r=process.argv[2]!,rows=[];
for(let repeat=0;repeat<3;repeat++)for(const name of ['routed','candidate']){
 const checked=await checkNativeRepair(r+'/input.kicad_pcb',r+'/routed.kicad_pcb',r+'/'+name+'.kicad_pcb');
 await writeFile(r+`/${name}-${repeat}.json`,JSON.stringify(checked,null,2));
 const row={name,repeat,errors:checked.newErrors.map(e=>e.type),lostSource:checked.lostTerminalPairs,opens:checked.opensAfter,lostCurrent:checked.repair?.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted,repairAccepted:checked.repair?.accepted};rows.push(row);console.log(JSON.stringify(row));
}await writeFile(r+'/results.json',JSON.stringify(rows,null,2));
