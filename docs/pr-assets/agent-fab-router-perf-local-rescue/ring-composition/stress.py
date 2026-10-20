from pathlib import Path
import subprocess,json,time,os
w=Path(__file__).resolve().parent;root=Path('/home/hyper/bench/wt/fr-perf');exits=[]
while not (w/'comparison.json').exists():time.sleep(2)
c=json.loads((w/'comparison.json').read_text());assert not c['regressions']and c['same_sessions']==78
if c['summary']['after']['total_s']>=c['summary']['before']['total_s']:
 print('No total timing gain; stop before expensive stress',flush=True);raise SystemExit(0)
def run(name,args,limit=1800):
 with (w/f'{name}.log').open('w') as log:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5',str(limit),*map(str,args)],stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
 exits.append({'name':name,'returncode':r.returncode});(w/'stress-exits.json').write_text(json.dumps(exits,indent=2)+'\n');assert r.returncode==0,name
 print(name,'complete',flush=True)
run('dense',['python3',w/'dense-native.py','/home/hyper/bench/wt/fp-perf/benchmarks/autorouter',w/'original',w/'candidate','/home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1',w/'dense'],4800)
run('compare-dense',['python3',w/'compare-dense.py',w/'dense',w/'original',w/'candidate',w/'dense-comparison.json'])
for case in ['l2','l3-cycle18']:
 for mode in ['original','candidate']:
  run(f'{case}-{mode}',['bun',w/'stress.ts',w/mode,f'/home/hyper/bench/boards/ladder/{case}.dsn',w/f'{case}-{mode}'],900)
run('slow',['bun',root/'docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/slow.ts',w/'candidate',w/'slow.json'],5400)
run('compare-slow',['python3',w/'compare-slow.py',root/'docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-front/slow.json.gz',w/'slow.json',w/'slow-comparison.json'])
