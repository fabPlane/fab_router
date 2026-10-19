from pathlib import Path
import subprocess,json,hashlib,sys
root=Path(__file__).resolve().parents[3];scratch=Path(sys.argv[1]).resolve();scratch.mkdir(exist_ok=False)
asset=root/'docs/pr-assets/agent-fab-router-perf-local-rescue'
protected=[root/'src/route/recovery-transaction.ts',root/'src/route/recovery-schedule.ts',root/'test/recovery-cancellation.test.ts',root/'test/recovery-schedule.test.ts']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
original={str(p):sha(p)for p in protected};results=[]
for variant in ['control','skip-final-checkpoint','ignore-route-control']:
 d=scratch/variant;d.mkdir()
 # Replace quoted relative imports explicitly; leave diagnostic text untouched.
 transaction=(root/'src/route/recovery-transaction.ts').read_text().replace("'../../spec/", "'"+str(root)+'/spec/').replace("'../", "'"+str(root)+'/src/')
 if variant=='skip-final-checkpoint':
  transaction=transaction.replace("  checkpoint?.();\n  kept=true;",'  kept=true;')
 (d/'recovery-transaction.ts').write_text(transaction)
 schedule=(root/'src/route/recovery-schedule.ts').read_text().replace("'../../spec/", "'"+str(root)+'/spec/').replace("'../", "'"+str(root)+'/src/')
 if variant=='ignore-route-control':schedule=schedule.replace(' const stop=()=>control.signal?.aborted?', ' control={};\n const stop=()=>control.signal?.aborted?')
 (d/'recovery-schedule.ts').write_text(schedule)
 for name in ['recovery-cancellation','recovery-schedule']:
  test=(root/f'test/{name}.test.ts').read_text().replace("'../src/route/recovery-", "'./recovery-").replace("'../src/", "'"+str(root)+'/src/').replace("'../docs/pr-assets/agent-fab-router-perf-local-rescue/", "'"+str(asset)+'/')
  (d/f'{name}.test.ts').write_text(test)
 with (d/'checks.log').open('w')as log:
  p=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','90','bun','test',str(d/'recovery-cancellation.test.ts'),str(d/'recovery-schedule.test.ts')],cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=100)
 text=(d/'checks.log').read_text()
 if variant=='control':assert p.returncode==0,text
 else:
  assert p.returncode==1,text
  expected='cancellation detected after exact validation'if variant=='skip-final-checkpoint'else'route-wide cancellation stops immediately'
  assert '(fail) '+expected in text,text
 results.append(dict(variant=variant,exit_code=p.returncode,log_sha256=sha(d/'checks.log')))
assert all(sha(Path(n))==v for n,v in original.items())
(scratch/'results.json').write_text(json.dumps(dict(source_sha256=original,results=results),indent=2)+'\n')
print(json.dumps(results,indent=2))
