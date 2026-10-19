"""Build disposable complete checked snapshots; production files stay unchanged."""
import gzip,hashlib,json,os,runpy,subprocess,sys
from pathlib import Path
repo,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);os.chdir(repo)
asset=Path('docs/pr-assets/agent-fab-router-perf-local-rescue')
measured=json.loads(gzip.decompress((Path(__file__).resolve().parent/'source-audit.json.gz').read_bytes()))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in measured['source'].items():assert sha(repo/name)==digest,name
for name,digests in measured['candidate_assertion_updates'].items():assert sha(repo/name)==digests['before'],name
sys.argv=['prepare.py',str(out)]
runpy.run_path(str(asset/'bounded-kind-spacing/prepare.py'),run_name='__main__')
archive=subprocess.check_output(['git','archive','HEAD','test','tools','docs','package.json','tsconfig.json'])
for mode in ['before','after']:
 p=out/mode
 subprocess.run(['tar','-x','-C',str(p)],input=archive,check=True)
 (p/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 # Exact work-boundary assertions move with the changed proposal graph, never relax.
 if mode=='after':
  for name in ['test/recovery-point-component.test.ts','test/recovery-component-anchor.test.ts','docs/pr-assets/agent-fab-router-perf-local-rescue/bounded-point-probe/controls.test.ts']:
   q=p/name;s=q.read_text()
   for a,b in {'18890':'17031','18889':'17030','14509':'12990','14510':'12991','14632':'13113','14633':'13114','14634':'13115','4257':'3917'}.items():s=s.replace(a,b)
   q.write_text(s)
  q=p/'test/recovery-public.test.ts';s=q.read_text();a='expect(before.report.incompleteAfter).toBe(6);expect(after.report.incompleteAfter).toBe(4);\n expect(after.report.added.tracks).toBe(before.report.added.tracks+2);expect(after.report.violationsAdded).toBe(0);\n expect(after.statsAfter.violations.total).toBe(0);expect(after.report.perNet.reduce((s,n)=>s+n.incomplete,0)).toBe(4);'
  b=a.replace('after.report.incompleteAfter).toBe(4)','after.report.incompleteAfter).toBe(2)').replace('before.report.added.tracks+2','before.report.added.tracks+4').replace('n.incomplete,0)).toBe(4)','n.incomplete,0)).toBe(2)')
  assert s.count(a)==1;q.write_text(s.replace(a,b))
 for name,digests in measured['candidate_assertion_updates'].items():assert sha(p/name)==digests[mode],name
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-spacing-candidate',str(p)],check=True)
 subprocess.run(['git','-C',str(p),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(p),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture isolated local spacing candidate'],check=True)
print(out)
