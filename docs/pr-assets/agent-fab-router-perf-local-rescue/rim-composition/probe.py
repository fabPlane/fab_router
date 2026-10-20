from pathlib import Path
import subprocess,time
w=Path(__file__).resolve().parent
for pair in range(3):
 for mode in (['original','candidate'] if pair%2==0 else ['candidate','original']):
  name=f'probe-{pair}-{mode}'
  with (w/(name+'.jsonl')).open('w') as out,(w/(name+'.stderr')).open('w') as err:
   r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','600','bun',str(w/'replay.ts'),str(w/mode),(w/'work-path.txt').read_text().strip(),'2'],stdout=out,stderr=err)
  print(name,r.returncode,flush=True)
  if r.returncode:raise SystemExit(r.returncode)
