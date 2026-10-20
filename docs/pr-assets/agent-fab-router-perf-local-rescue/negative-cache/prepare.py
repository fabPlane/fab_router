"""Recreate immutable baseline and negative-shaping-cache candidate snapshots."""
import gzip,hashlib,json,subprocess,sys
from pathlib import Path
repo,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);here=Path(__file__).resolve().parent
archive=subprocess.check_output(['git','archive','1125f2a','src','spec','test','tools','docs','package.json','tsconfig.json'],cwd=repo)
audit={}
for mode in ['before','after']:
 p=out/mode;p.mkdir(parents=True,exist_ok=False)
 subprocess.run(['tar','-x','-C',str(p)],input=archive,check=True)
 if mode=='after':subprocess.run(['git','apply','--unidiff-zero','--unsafe-paths',str(here/'candidate.patch')],cwd=p,input=b'',check=True)
 (p/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-negative-cache',str(p)],check=True)
 subprocess.run(['git','-C',str(p),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(p),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture negative shaping cache comparison'],check=True)
 audit[mode]={str(q.relative_to(p)):hashlib.sha256(q.read_bytes()).hexdigest()for top in ['src','spec','test']for q in sorted((p/top).rglob('*'))if q.is_file()}
record=here/'source-audit.json.gz'
if record.exists():assert audit==json.loads(gzip.decompress(record.read_bytes())),'Source drift'
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
