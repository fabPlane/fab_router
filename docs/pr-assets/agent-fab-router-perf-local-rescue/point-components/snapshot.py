"""Freeze both committed engine revisions and enable recovery through a local API shim."""
from pathlib import Path
import json,subprocess,sys,hashlib
repo,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);assert not out.exists();out.mkdir(parents=True)
records={}
for mode,revision in [('before','4b577bbb36378188c8ef470177d8b354edaefd3b'),('after','8e53e7d')]:
 root=out/mode;root.mkdir()
 archive=subprocess.check_output(['git','-C',str(repo),'archive',revision,'src','spec','tools','package.json','tsconfig.json'])
 subprocess.run(['tar','-x','-C',str(root)],input=archive,check=True)
 files=[p for name in ['src','spec/types','tools']for p in (root/name).rglob('*')if p.is_file()]
 records[mode]={'source_revision':subprocess.check_output(['git','-C',str(repo),'rev-parse',revision],text=True).strip(),'sha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()for p in files}}
 (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 shim=root/'entry/src';shim.mkdir(parents=True)
 (shim/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 # The benchmark requires git metadata. These synthetic local commits include the
 # exact archived source plus the shim; original revisions/hashes stay explicit.
 subprocess.run(['git','init','-b',f'agent/fab-router-perf-repro-{mode}',str(root)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(root),'add','src','spec','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(root),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-m','Capture reproducible recovery benchmark source'],check=True,stdout=subprocess.DEVNULL)
(out/'source-revisions.json').write_text(json.dumps(records,indent=2)+'\n')
