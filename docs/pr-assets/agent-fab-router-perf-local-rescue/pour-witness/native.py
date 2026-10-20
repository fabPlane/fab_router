"""Full frozen-suite control versus disposable multi-witness probe, both opt-in."""
import json,subprocess,sys,hashlib
from pathlib import Path
root,probes,bench,out=map(lambda s:Path(s).resolve(),sys.argv[1:])
out.mkdir(exist_ok=False)
vertex=probes
subprocess.run(['git','init','-q','-b','agent/fab-router-perf-pour-witness',str(vertex)],check=True)
# Local identity only; this experiment is never pushed or used as a downstream pin.
subprocess.run(['git','-C',str(vertex),'add','src','spec','package.json','tsconfig.json'],check=True)
subprocess.run(['git','-C',str(vertex),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Prepare disposable pour witness experiment'],check=True)
entry=vertex/'entry/src';entry.mkdir(parents=True)
(entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
files=[p for base in (root,vertex) for top in ('src','spec') for p in (base/top).rglob('*') if p.is_file()]+[entry/'api.ts']
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in files}
(out/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
for mode,source in [('before',root/'docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting'),('vertex',vertex/'entry')]:
 with (out/f'{mode}.log').open('w') as log:
  run=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','2400','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source),'--out',str(out/mode)],cwd=bench,stdout=log,stderr=subprocess.STDOUT,timeout=2450)
 assert run.returncode==0,(mode,run.returncode)
 assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==v for p,v in hashes.items())
