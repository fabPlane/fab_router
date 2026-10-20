import {resolve,join} from 'node:path';import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));const execute=promisify(execFile);
const root=resolve(process.argv[2]!);const retained=resolve(root,'../c217/power');await mkdir(join(root,'native'));
for(const name of ['input','routed'])for(const ext of ['.kicad_pcb','.kicad_pro','.kicad_dru'])await copyFile(join(retained,name+ext),join(root,'native',name+ext));
const base=join(root,'native');const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const before=await checkNativeRepair(join(base,'input.kicad_pcb'),join(base,'routed.kicad_pcb'),join(base,'routed.kicad_pcb'));
 const report=join(base,`before-${repeat}.json`);await writeFile(report,JSON.stringify(before,null,2));
 let oldRows:any[]=[];let newRows:any[]=[];
 for(const version of ['before','after']){
  const out=join(base,`${version}-${repeat}`);
  await execute('python3',[join(root,`${version}.py`),'--source',join(base,'input.kicad_pcb'),'--current',join(base,'routed.kicad_pcb'),'--report',report,'--out',out]);
  const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
  if(version==='before')oldRows=manifest;else newRows=manifest;
 }
 if(JSON.stringify(newRows.slice(0,oldRows.length))!==JSON.stringify(oldRows))throw new Error('Prior prefix changed');
 for(const row of oldRows)if(!(await readFile(join(base,`before-${repeat}`,row.name))).equals(await readFile(join(base,`after-${repeat}`,row.name))))throw new Error('Prior candidate bytes changed');
 const proposal=newRows.find(p=>p.label[0]==='via'&&p.label[1]==='e57c15b7-d609-442a-9cca-2c520d20bbab');if(!proposal)throw new Error('No via proposal');
 const candidate=join(base,`after-${repeat}`,proposal.name);for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(base,'input'+ext),candidate.replace(/\.kicad_pcb$/,ext));
 const after=await checkNativeRepair(join(base,'input.kicad_pcb'),join(base,'routed.kicad_pcb'),candidate);await writeFile(join(base,`after-${repeat}.json`),JSON.stringify(after,null,2));
 if(!after.accepted||after.newErrors.length||after.lostTerminalPairs||after.repair?.lostTerminalPairs||after.opensAfter!==95)throw new Error('Unsafe repair');
 rows.push({repeat,oldProposals:oldRows.length,newProposals:newRows.length,priorPrefixByteExact:true,proposal,thermalsBefore:before.newErrors.length,thermalsAfter:after.newErrors.length,opensBefore:before.opensAfter,opensAfter:after.opensAfter,lostSource:after.lostTerminalPairs,lostCurrent:after.repair?.lostTerminalPairs,accepted:after.accepted,ownership:after.nativeCopperChecks});
 await writeFile(join(root,'measurement.json'),JSON.stringify(rows,null,2));console.log(rows.at(-1));
}
