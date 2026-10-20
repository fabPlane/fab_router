import {checkNativeRepair} from '/home/hyper/bench/wt/fr-bugs/tools/native-drc-gate.ts';
import {writeFile} from 'node:fs/promises';
const r='/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c206/probe';
for(let i=0;i<6;i++) {const x=await checkNativeRepair(`${r}/source.kicad_pcb`,`${r}/routed.kicad_pcb`,`${r}/${i}.kicad_pcb`);await writeFile(`${r}/${i}.json`,JSON.stringify(x,null,2)); console.log(i,x.newErrors.map(e=>e.type),x.opensAfter,x.lostTerminalPairs,x.repair?.accepted,x.repair?.lostTerminalPairs,x.accepted);}
