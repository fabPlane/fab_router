"""Prepare isolated sources for the same single-variable native comparison.
Usage: python3 prepare-repro.py ENGINE_GIT RUN BASE_REV RING_REV
"""
from pathlib import Path
import json,subprocess,sys
repo,run=map(lambda s:Path(s).resolve(),sys.argv[1:3]);old,new=sys.argv[3:5]
run.mkdir(exist_ok=False)
for mode,rev in [('original',old),('candidate',new)]:
 p=run/mode;p.mkdir()
 subprocess.run(['tar','-x','-C',str(p)],input=subprocess.check_output(['git','-C',str(repo),'archive',rev]),check=True)
 (p/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-ring-composition',str(p)],check=True)
 subprocess.run(['git','-C',str(p),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(p),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture exact ring containment composition comparison'],check=True)
for name in ['native.py','compare.py']:(run/name).write_bytes((Path(__file__).resolve().parent/name).read_bytes())
(run/'source.json').write_text(json.dumps({'base':old,'candidate':new,'localRecovery':True},indent=2)+'\n')
