from pathlib import Path
import subprocess,json,time
import sys
base=Path(sys.argv[1]).resolve();bench=Path(sys.argv[2]).resolve()
for mode in ['original','candidate']:
 start=time.monotonic()
 with (base/f'native-{mode}.log').open('w') as log:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','3000','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(base/'source'/mode/'entry'),'--out',str(base/f'native-{mode}')],cwd=bench,stdout=log,stderr=subprocess.STDOUT)
 (base/f'native-{mode}-exit.json').write_text(json.dumps(dict(returncode=r.returncode,wall_s=time.monotonic()-start))+'\n')
 if r.returncode:raise SystemExit(r.returncode)
