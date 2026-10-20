"""Offline import/refill/check of paired residual outputs; never a scored router run."""
import json,subprocess,shutil,hashlib,sys
from pathlib import Path
s=Path(sys.argv[1]).resolve()
bench=Path(sys.argv[2]).resolve()
fixture=bench/'cases/kitspace-aquarius-j4'
out=s/'native-probe';out.mkdir(exist_ok=False)
rows=[]
for repeat in range(1,4):
 for mode in (['before','after'] if repeat%2 else ['after','before']):
  d=out/f'{mode}-{repeat}';d.mkdir();shutil.copyfile(s/f'probe/{mode}-{repeat}.ses',d/'board.ses')
  cmds=[['/usr/bin/python3',str(bench/'harness/dsn-path.py'),'import','--input-dir',str(fixture),'--work-dir',str(d),'--output-pcb',str(d/'final.kicad_pcb')],['/usr/bin/python3',str(bench/'harness/native-check-v4.3.py'),'--fixture',str(fixture),'--output',str(d/'final.kicad_pcb'),'--out',str(d/'check.json')]]
  exits=[]
  for i,cmd in enumerate(cmds):
   with (d/f'step{i}.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=120)
   exits.append(p.returncode)
   assert p.returncode==0,(mode,repeat,i,p.returncode)
  rows.append({'mode':mode,'repeat':repeat,'exits':exits,'check':json.loads((d/'check.json').read_text())})
  (out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
  print(mode,repeat,{k:rows[-1]['check'].get(k) for k in ['pass','opens','new_errors','vias','length_mm','ground_connected','island_findings']},flush=True)
