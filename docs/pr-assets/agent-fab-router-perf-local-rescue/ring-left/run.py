from pathlib import Path
import subprocess,json
w=Path(__file__).parent
p=Path('/home/hyper/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/default-slow-profile')
rows=[]
for case in ['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']:
 for repeat in range(3):
  for variant in (['control','candidate'] if repeat%2==0 else ['candidate','control']):
   name=f'{case}-{repeat}-{variant}';out=w/name
   with (w/(name+'.log')).open('w') as log:
    subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','180','bun',str(p/'replay.ts'),str(w/variant),str(p/case),str(out)],stdout=log,stderr=subprocess.STDOUT,check=True)
   rows.append(dict(case=case,repeat=repeat,variant=variant,seconds=json.loads((out/'timing.json').read_text())['seconds']))
   (w/'timings.json').write_text(json.dumps(rows,indent=2)+'\n')
   print(name,rows[-1]['seconds'],flush=True)
