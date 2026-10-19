from pathlib import Path
import subprocess,tarfile,io,json,hashlib,gzip,sys
root=Path(__file__).resolve().parents[4]; work=Path(sys.argv[1]).resolve()
assert not work.exists(), 'Output must be unused'
work.mkdir(parents=True)
for mode in ['original','candidate']:
 d=work/mode;d.mkdir()
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','HEAD'],cwd=root))) as t:t.extractall(d,filter='data')
 (d/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
 p=d/'src/geom/predicates.ts'
 if mode=='candidate':
  s=p.read_text();needle='    const a = pts[j]!, b = pts[i]!;\n    if (onSeg(p, a, b))'
  assert s.count(needle)==1
  p.write_text(s.replace(needle,'    const a = pts[j]!, b = pts[i]!;\n    if (p.y < Math.min(a.y, b.y) || p.y > Math.max(a.y, b.y)) continue;\n    if (onSeg(p, a, b))'))
inputs=work/'input';inputs.mkdir()
a=root/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,source in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
 (inputs/name).write_bytes(gzip.decompress((a/source).read_bytes()))
audit={}
for mode in ['original','candidate']:
 audit[mode]={str(p.relative_to(work/mode)):hashlib.sha256(p.read_bytes()).hexdigest() for sub in ['src','spec'] for p in sorted((work/mode/sub).rglob('*')) if p.is_file()}
assert audit['original'].keys()==audit['candidate'].keys()
assert [p for p in audit['original'] if audit['original'][p]!=audit['candidate'][p]]==['src/geom/predicates.ts']
(work/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')

for mode in ['original','candidate']:
 p=work/mode;entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-ring-native',str(p)],check=True)
 subprocess.run(['git','-C',str(p),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(p),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture boundary prefilter comparison'],check=True)
