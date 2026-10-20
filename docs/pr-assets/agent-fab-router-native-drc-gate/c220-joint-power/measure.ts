import {resolve,join} from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
const {checkNativeRepair}=await import(resolve('tools/native-drc-gate.ts'));
const root=resolve(process.argv[2]!);const fixture=resolve('test/fixtures/native-aquarius-thermal');
const source=gunzipSync(await readFile(join(fixture,'input.kicad_pcb.gz')));const text=source.toString(),end=text.lastIndexOf(')');
const added=gunzipSync(await readFile(join(fixture,'full-power-stage0-added.sexpr.gz'))).toString();
const power=added.replace(/\((at|start|end) 164\.1045 50\.6008\)/g,'($1 163.804500 50.900800)');
const joint=power.replace(/\((at|start|end) 163\.3455 51\.5585\)/g,'($1 163.345500 52.078500)');
const rows=[];
for(let repeat=0;repeat<3;repeat++){
 const dir=join(root,`repeat-${repeat}`);await mkdir(dir);
 for(const [name,copper] of [['input',''],['routed',added],['power',power],['joint',joint]]){
  await writeFile(join(dir,name+'.kicad_pcb'),name==='input'?source:`${text.slice(0,end)}\n${copper}\n${text.slice(end)}`);
  for(const ext of ['.kicad_pro','.kicad_dru'])await writeFile(join(dir,name+ext),await readFile(join(fixture,'board'+ext)));
 }
 for(const name of ['routed','power','joint']){
  const start=performance.now();const c=await checkNativeRepair(join(dir,'input.kicad_pcb'),join(dir,'routed.kicad_pcb'),join(dir,name+'.kicad_pcb'));
  await writeFile(join(dir,name+'.json'),JSON.stringify(c,null,2)+'\n');
  const row={repeat,name,seconds:(performance.now()-start)/1000,errors:c.newErrors.map(e=>e.type),opens:c.opensAfter,lostSource:c.lostTerminalPairs,lostCurrent:c.repair?.lostTerminalPairs,ownership:c.nativeCopperChecks,accepted:c.accepted,relativeAccepted:c.repair?.accepted};rows.push(row);console.log(row);await writeFile(join(root,'strict-results.json'),JSON.stringify(rows,null,2)+'\n');
  if(c.accepted||c.newErrors.length!==({routed:6,power:8,joint:5}[name]!)||row.lostCurrent!== (name==='power'?57:0)||row.lostSource!== (name==='power'?292:235))throw Error('Unexpected diagnostic result');
 }
}
