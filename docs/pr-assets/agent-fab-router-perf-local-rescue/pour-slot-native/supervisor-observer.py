from pathlib import Path
import json,subprocess,time,os
base=Path('/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle66/final')
start=time.monotonic()
while True:
 c=json.loads((base/'native-original/controls.json').read_text())
 if c.get('complete'):break
 try:os.kill(2051859,0)
 except ProcessLookupError:raise RuntimeError('original died incomplete')
 if time.monotonic()-start>2900:raise TimeoutError('original observer deadline')
 time.sleep(5)
(base/'native-original-exit.json').write_text(json.dumps({'returncode':None,'supervisor_exit':143,'recovered_complete':True,'note':'outer supervisor terminated; original benchmark continued; completion verified via controls; exit code unavailable'})+'\n')
print('Observed complete original',flush=True)
start=time.monotonic()
with (base/'native-candidate.log').open('w') as log:
 r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','3000','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(base/'candidate/entry'),'--out',str(base/'native-candidate')],cwd='/home/hyper/bench/wt/fp-perf',stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(base/'native-candidate-exit.json').write_text(json.dumps({'returncode':r.returncode,'wall_s':time.monotonic()-start})+'\n')
assert r.returncode==0
