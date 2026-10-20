const {checkNativeRepair}=await import(process.argv[2]+'/tools/native-drc-gate.ts');
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';import {join} from 'node:path';
const root=process.argv[3];const dir=join(root,'backbone');await mkdir(dir);
const source=await readFile(join(root,'input.kicad_pcb'),'utf8');
const added=await readFile(join(process.argv[2],'test/fixtures/native-aquarius-thermal/backbone-added.sexpr'),'utf8');
const narrow=await readFile(join(root,'r0.06-s1/board.kicad_pcb'),'utf8');
const start=narrow.indexOf('(segment (start 176.139600');const tail=narrow.slice(start,narrow.lastIndexOf(')'));
const witness=added.split('\n').filter(s=>s.includes('9d2e32dc-507a-41da-b2b4-a62b38b96fca'))[0]!;
const insert=(s:string)=>source.slice(0,source.lastIndexOf(')'))+s+'\n)\n';
for(const [role,text] of [['input',source],['routed',insert(added)],['candidate',insert(added.replace(witness,tail))]]){
 await writeFile(join(dir,role+'.kicad_pcb'),text!);for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(root,'input'+ext),join(dir,role+ext));}
for(const [label,candidate] of [['before','routed'],['after','candidate']]){
 const checked=await checkNativeRepair(join(dir,'input.kicad_pcb'),join(dir,'routed.kicad_pcb'),join(dir,candidate+'.kicad_pcb'));
 await writeFile(join(dir,label+'.json'),JSON.stringify(checked,null,2)+'\n');console.log(label,{accepted:checked.accepted,errors:checked.newErrors.map(x=>x.type),opens:checked.opensAfter,lost:checked.lostTerminalPairs,owned:checked.nativeCopperChecks,repair:checked.repair?.accepted});}
