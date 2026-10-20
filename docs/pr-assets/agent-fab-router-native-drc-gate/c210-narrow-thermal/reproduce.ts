const {checkNativeRepair}=await import(process.argv[2]+'/tools/native-drc-gate.ts');
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
const fixture=process.argv[2]+'/test/fixtures/native-aquarius-thermal';
const root=process.argv[3]; if(!root)throw new Error("Usage: bun reproduce.ts REPO NEW_OUTPUT_DIR"); await mkdir(root);
const source=gunzipSync(await readFile(join(fixture,'axial-input.kicad_pcb.gz'))).toString();
const added=await readFile(join(fixture,'added.sexpr'),'utf8');
const insert=(s:string)=>source.slice(0,source.lastIndexOf(')'))+s+'\n)\n';
await writeFile(join(root,'input.kicad_pcb'),source);await writeFile(join(root,'routed.kicad_pcb'),insert(added));
for(const role of ['input','routed'])for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(fixture,'board'+ext),join(root,role+ext));
const rows=[];
for(const radius of [.025,.05,.075,.1,.15,.2,.055,.06,.065,.07,.072,.073])for(const side of radius>=.055&&radius<=.073?[1]:[1,-1]){
 const label=`r${radius}-s${side}`,dir=join(root,label);await mkdir(dir);
 const points=[[176.1396,49.5902],[176.1396-radius,49.5902+side*radius],[174.03+radius,49.5902+side*radius],[174.03,49.5902]];
 const tracks=points.slice(1).map((b,i)=>`(segment (start ${points[i]!.map(x=>x.toFixed(6)).join(' ')}) (end ${b.map(x=>x.toFixed(6)).join(' ')}) (width 0.2032) (layer "B.Cu") (net "Net-(C1-Pad1)") (uuid "${crypto.randomUUID()}"))`).join('\n');
 const candidate=join(dir,'board.kicad_pcb');await writeFile(candidate,insert(tracks));
 for(const ext of ['.kicad_pro','.kicad_dru'])await copyFile(join(fixture,'board'+ext),join(dir,'board'+ext));
 const checked=await checkNativeRepair(join(root,'input.kicad_pcb'),join(root,'routed.kicad_pcb'),candidate);
 await writeFile(join(dir,'report.json'),JSON.stringify(checked,null,2)+'\n');
 const row={label,radius,side,accepted:checked.accepted,errors:checked.newErrors.map(x=>x.type),opens:checked.opensAfter,lost:checked.lostTerminalPairs,nativeCopperChecks:checked.nativeCopperChecks,lostRouted:checked.repair?.lostTerminalPairs};rows.push(row);
 await writeFile(join(root,'summary.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(row));
}
