from pathlib import Path
import hashlib,json,subprocess,time
w=Path(__file__).resolve().parent;root=Path('/home/hyper/bench/wt/fr-perf')
while not (w/'target-summary.json').exists():time.sleep(2)
rows=json.loads((w/'target-records.json').read_text());assert len(rows)==6
summary=json.loads((w/'target-summary.json').read_text())
for r in rows:
 assert not r['result']['measured'].get('aborted',False)
 assert all(not k.startswith('invariant:')or v is not False for k,v in r['result']['measured'].items())
subprocess.run(['python3',w/'profile.py'],check=True)
audit=json.loads((w/'source-audit.json').read_text())['candidate']
for name,h in audit.items():
 if name.startswith('entry/'):continue
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==h,name
with (w/'candidate-checks.log').open('w')as log:
 r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bash','-c','bun run typecheck && bun run check:layers && bun run test'],cwd=root,stdout=log,stderr=subprocess.STDOUT)
(w/'candidate-checks-exit.json').write_text(json.dumps({'returncode':r.returncode})+'\n');assert r.returncode==0
if not summary['adverse_pairs']:
 (w/'checks.log').write_bytes((w/'candidate-checks.log').read_bytes());(w/'checks-exit.json').write_bytes((w/'candidate-checks-exit.json').read_bytes())
print('PASS candidate source inventory and fresh complete production gate; fresh adverse pairs:',summary['adverse_pairs'],flush=True)
