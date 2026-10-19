from pathlib import Path
import subprocess,json,time
import sys
base=Path(sys.argv[1]).resolve();bench=Path(sys.argv[2]).resolve()
for mode in [sys.argv[3]]:
 assert mode in ('original','candidate')
 source=base/mode
 entry=source/'entry/src'
 if not entry.exists():
  entry.mkdir(parents=True)
  (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 if not (source/'.git').exists():
  subprocess.run(['git','init','-q','-b','agent/fab-router-perf-quilt-front-native',str(source)],check=True)
  subprocess.run(['git','-C',str(source),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
  subprocess.run(['git','-C',str(source),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture isolated bounded quilt front-cache comparison'],check=True)
 start=time.monotonic()
 with (base/f'native-{mode}.log').open('w') as log:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','3000','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(base/mode/'entry'),'--out',str(base/f'native-{mode}')],cwd=bench,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (base/f'native-{mode}-exit.json').write_text(json.dumps(dict(returncode=r.returncode,wall_s=time.monotonic()-start))+'\n')
 if r.returncode:raise SystemExit(r.returncode)
