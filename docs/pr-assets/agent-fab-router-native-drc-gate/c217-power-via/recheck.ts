import {resolve,join} from 'node:path';import {writeFile} from 'node:fs/promises';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
const root=resolve(process.argv[2]!);const rows=[];
for(const family of ['power','full']) for(let repeat=0;repeat<3;repeat++) for(const name of ['routed','candidate']) {
 const p=join(root,family);const checked=await checkNativeRepair(join(p,'input.kicad_pcb'),join(p,'routed.kicad_pcb'),join(p,name+'.kicad_pcb'));
 await writeFile(join(p,`${name}-${repeat}.json`),JSON.stringify(checked,null,2));
 const row={family,name,repeat,errors:checked.newErrors.map(e=>e.type),opens:checked.opensAfter,lostSource:checked.lostTerminalPairs,lostCurrent:checked.repair?.lostTerminalPairs,ownership:checked.nativeCopperChecks,accepted:checked.accepted,relativeAccepted:checked.repair?.accepted};rows.push(row);console.log(row);
 await writeFile(join(root,'strict-results.json'),JSON.stringify(rows,null,2));
}
