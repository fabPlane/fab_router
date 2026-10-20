import {searchNativeThermals as after} from '/home/hyper/bench/wt/fr-bugs/tools/native-thermal-search.ts';
import {searchNativeThermals as before} from './before-engine/tools/native-thermal-search.ts';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root='/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c206';
const fixture='/home/hyper/bench/wt/fr-bugs/test/fixtures/native-aquarius-thermal';
for(const phase of ['before','after'] as const) for(let repeat=0;repeat<3;repeat++) {
 const dir=`${root}/native-${phase}-${repeat}`;await mkdir(dir);
 const src=gunzipSync(await readFile(`${fixture}/axial-input.kicad_pcb.gz`)).toString();
 const end=src.lastIndexOf(')'); const added=await readFile(`${fixture}/added.sexpr`,'utf8');
 for(const role of ['source','routed']) {await writeFile(`${dir}/${role}.kicad_pcb`,role==='source'?src:`${src.slice(0,end)}\n${added}\n${src.slice(end)}`);for(const ext of ['.kicad_pro','.kicad_dru']) await writeFile(`${dir}/${role}${ext}`,await readFile(`${fixture}/board${ext}`));}
 const started=Date.now();const result=await (phase==='before'?before:after)(`${dir}/source.kicad_pcb`,`${dir}/routed.kicad_pcb`,`${dir}/accepted.json`,`${dir}/search`,1);
 const summary={phase,repeat,seconds:(Date.now()-started)/1000,published:result.published,repaired:result.repaired,attempts:result.attempts.length,errors:result.validation.newErrors.length,opens:result.validation.opensAfter,lostSource:result.validation.lostTerminalPairs,lostRouted:result.validation.repair?.lostTerminalPairs};
 await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}
