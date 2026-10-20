from pathlib import Path
import subprocess,json,time
w=Path(__file__).resolve().parent
for mode in ['candidate','original']:
 start=time.monotonic()
 with (w/f'native-{mode}.log').open('w') as log:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','3000','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(w/mode/'entry'),'--out',str(w/f'native-{mode}')],cwd='/home/hyper/bench/wt/fp-perf',stdout=log,stderr=subprocess.STDOUT)
 (w/f'native-{mode}-exit.json').write_text(json.dumps({'returncode':r.returncode,'wall_s':time.monotonic()-start})+'\n')
 print('native',mode,r.returncode,flush=True)
 if r.returncode:raise SystemExit(r.returncode)
subprocess.run(['python3',w/'compare.py',w/'native-original',w/'native-candidate',w/'comparison.json'],check=True)
