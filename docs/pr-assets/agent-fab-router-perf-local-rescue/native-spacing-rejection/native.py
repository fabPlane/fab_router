from pathlib import Path
import subprocess,json,sys
base,bench=map(lambda p:Path(p).resolve(),sys.argv[1:])
for mode in ['before','after']:
 source=base/'source'/mode
 with (base/f'native-{mode}.log').open('w') as log:
  result=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','3000','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source/'entry'),'--out',str(base/f'native-{mode}')],cwd=bench,stdout=log,stderr=subprocess.STDOUT)
 (base/f'native-{mode}-exit.json').write_text(json.dumps({'returncode':result.returncode})+'\n')
 if result.returncode:raise SystemExit(result.returncode)
