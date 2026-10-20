from pathlib import Path
import subprocess,json,hashlib
w=Path(__file__).resolve().parent
for mode in ['original','candidate']:
 p=w/mode
 entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 for args in [['init','-q','-b','agent/fab-router-perf-rim-composition'],['add','src','spec','test','tools','package.json','tsconfig.json','entry'],['-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture rim traversal composition comparison']]:subprocess.run(['git','-C',str(p),*args],check=True)
files={m:{str(p.relative_to(w/m)):hashlib.sha256(p.read_bytes()).hexdigest()for folder in ['src','spec','test','tools']for p in (w/m/folder).rglob('*')if p.is_file()}for m in ['original','candidate']}
diff=[n for n in files['original'].keys()|files['candidate'].keys()if files['original'].get(n)!=files['candidate'].get(n)]
assert sorted(diff)==['src/geom/onboard.ts','test/onboard-invariance.test.ts'],diff
(w/'source-audit.json').write_text(json.dumps({'base_commit':(w/'base.txt').read_text().strip(),'modified':diff,'files':files},indent=2)+'\n')
