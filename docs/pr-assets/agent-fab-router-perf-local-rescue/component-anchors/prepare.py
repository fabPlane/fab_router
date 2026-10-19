"""Create immutable benchmark sources from two committed revisions."""
from pathlib import Path
import hashlib,io,json,subprocess,sys,tarfile
repo,before,after,out=sys.argv[1:];repo=Path(repo).resolve();out=Path(out).resolve();out.mkdir(exist_ok=False)
hashes={}
for mode,commit in [('before',before),('after',after)]:
 root=out/mode;root.mkdir()
 data=subprocess.check_output(['git','-C',str(repo),'archive',commit,'src','spec','package.json','tsconfig.json'])
 with tarfile.open(fileobj=io.BytesIO(data))as archive:archive.extractall(root,filter='data')
 (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 (root/'.source-commit').write_text(subprocess.check_output(['git','-C',str(repo),'rev-parse',commit],text=True))
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-component-repro',str(root)],check=True)
 subprocess.run(['git','-C',str(root),'add','src','spec','package.json','tsconfig.json'],check=True)
 subprocess.run(['git','-C',str(root),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Prepare immutable component recovery comparison'],check=True)
 entry=root/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 hashes[mode]={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()for top in ('src','spec/types','entry')for p in sorted((root/top).rglob('*'))if p.is_file()}
(out/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
