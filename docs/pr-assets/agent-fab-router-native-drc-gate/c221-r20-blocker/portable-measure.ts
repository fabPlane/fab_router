import {resolve,join} from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
const root=resolve(process.argv[2]!);const controls=join(root,'controls');
const candidate=join(root,'r20-offset-2/submitted.kicad_pcb');
const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const dir=join(root,`strict-${repeat}`);await mkdir(dir);
 for(const [name,board] of [['input',join(controls,'input.kicad_pcb')],['before',join(controls,'joint.kicad_pcb')],['after',candidate]]){
  await writeFile(join(dir,name+'.kicad_pcb'),await readFile(board!));
  for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(dir,name+ext),await readFile(join(controls,'input'+ext)));
 }
 for(const name of ['before','after']){
  const start=performance.now();const c=await checkNativeRepair(join(dir,'input.kicad_pcb'),join(dir,'before.kicad_pcb'),join(dir,name+'.kicad_pcb'));
  await writeFile(join(dir,name+'.json'),JSON.stringify(c,null,2)+'\n');
  const row={repeat,name,seconds:(performance.now()-start)/1000,errors:c.newErrors.map(e=>e.type),opens:c.opensAfter,lostSource:c.lostTerminalPairs,lostCurrent:c.repair?.lostTerminalPairs,ownership:c.nativeCopperChecks,accepted:c.accepted,relativeAccepted:c.repair?.accepted};rows.push(row);console.log(row);await writeFile(join(root,'strict-results.json'),JSON.stringify(rows,null,2)+'\n');
 }
}
