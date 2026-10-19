"""Run one disposable source after the paired supervisor releases its harness lock."""
import hashlib,json,subprocess,sys
from pathlib import Path
source,bench,out=map(lambda s:Path(s).resolve(),sys.argv[1:])
assert not out.exists()
if not (source/'.git').exists():
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-pour-witness',str(source)],check=True)
 subprocess.run(['git','-C',str(source),'add','src','spec','package.json','tsconfig.json'],check=True)
 subprocess.run(['git','-C',str(source),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Prepare disposable pour witness revision'],check=True)
entry=source/'entry/src';entry.mkdir(parents=True)
(entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
files=[p for top in ('src','spec') for p in (source/top).rglob('*')if p.is_file()]+[entry/'api.ts']
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in files}
run=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','2400','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source/'entry'),'--out',str(out)],cwd=bench,timeout=2450)
assert run.returncode==0,run.returncode
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==v for p,v in hashes.items())
(out/'experiment-source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
