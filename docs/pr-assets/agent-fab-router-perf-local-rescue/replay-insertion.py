import json,hashlib,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
assets=Path(__file__).resolve().parent
prior=json.loads((assets/'grid-census.json').read_text())['attempts']
works=list(Path(sys.argv[2]).resolve().glob('runs/*/fab-router/work'))
if (root/'insertion-results.json').exists():raise SystemExit('output exists')
rows=[]
for residual in sorted(assets.glob('residual-*.json')):
 r=json.loads(residual.read_text())
 if 'connections' not in r: continue
 case=residual.stem.removeprefix('residual-')
 a=next(a for a in prior if a['case']==case and a['seed']==1)
 work=next(w for w in works if hashlib.sha256((w/'board.dsn').read_bytes()).hexdigest()==r['input_sha256'] and json.loads((w/'router-summary.json').read_text())['settings']['seed']==1)
 out=root/(residual.name)
 if out.exists():raise SystemExit('replay output exists')
 p=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','180','bun',str(assets/'residual-grid.ts'),str(root/'source'),str(work),str(out)],capture_output=True,text=True)
 (root/(case+'.log')).write_text(p.stdout+p.stderr)
 assert p.returncode==0,p.stderr
 census=json.loads(next(l.removeprefix('GRID_CENSUS ') for l in p.stdout.splitlines() if l.startswith('GRID_CENSUS ')))
 for c in r['connections']:
  new=census[c['key']];old=a['census'][c['key']]
  assert {k:v for k,v in new.items() if k!='stages'}==old
  rows.append({'case':case,'net':c['netName'],'key':c['key'],**new})
(root/'insertion-results.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
