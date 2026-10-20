from pathlib import Path
import subprocess,json,time
w=Path(__file__).resolve().parent
b=w.parent/'cycle78'
work=(w/'work-path.txt').read_text()
runner=str(w/'replay.ts')
for pair in range(4):
 for mode in (['original','candidate'] if pair%2==0 else ['candidate','original']):
  name=f'{pair}-{mode}'
  with (w/(name+'.jsonl')).open('w') as out,(w/(name+'.stderr')).open('w') as err:
   args=['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','600','bun']
   if pair==3:args+=['--cpu-prof','--cpu-prof-dir',str(w),'--cpu-prof-name',name+'.cpuprofile']
   args+=[runner,str(b/mode),work,'2']
   start=time.monotonic();r=subprocess.run(args,stdout=out,stderr=err)
  print(name,r.returncode,time.monotonic()-start,flush=True)
  if r.returncode:raise SystemExit(r.returncode)
