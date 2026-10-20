from pathlib import Path
import subprocess,json,time,hashlib
w=Path(__file__).resolve().parent;root=Path('/home/hyper/bench/wt/fr-perf')
while True:
 p=w/'stress-exits.json'
 try:r=json.loads(p.read_text())if p.exists()else[]
 except json.JSONDecodeError:r=[]
 if len(r)==8:break
 if any(x['returncode']for x in r):raise SystemExit('Stress failed; inspect retained logs')
 time.sleep(2)
assert all(x['returncode']==0 for x in r)
assert not json.loads((w/'slow-comparison.json').read_text())['adverse']
assert not json.loads((w/'dense-comparison.json').read_text())['regressions']
subprocess.run(['python3',w/'profile.py'],check=True)
audit=json.loads((w/'source-audit.json').read_text())['candidate']
for name,h in audit.items():
 if name.startswith('entry/'):continue
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==h,name
with (w/'checks.log').open('w') as log:
 r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bash','-c','bun run typecheck && bun run check:layers && bun run test'],cwd=root,stdout=log,stderr=subprocess.STDOUT)
(w/'checks-exit.json').write_text(json.dumps({'returncode':r.returncode})+'\n')
assert r.returncode==0
print('PASS measured-source audit and fresh production gate',flush=True)
