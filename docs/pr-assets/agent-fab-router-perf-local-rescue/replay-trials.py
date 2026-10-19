"""Exact-session diagnostic replay, preserving search and legalisation stage counts."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
prior=json.loads((assets/'insertion-results.json').read_text())
works=list(Path(sys.argv[2]).resolve().glob('runs/*/fab-router/work'))
if (root/'trial-results.json').exists():raise SystemExit('output exists')
rows=[]
for residual in sorted(assets.glob('residual-*.json')):
 r=json.loads(residual.read_text())
 if not isinstance(r,dict) or 'connections' not in r:continue
 case=residual.stem.removeprefix('residual-')
 work=next(w for w in works if hashlib.sha256((w/'board.dsn').read_bytes()).hexdigest()==r['input_sha256'] and json.loads((w/'router-summary.json').read_text())['settings']['seed']==1)
 out=root/residual.name
 if out.exists() or (root/(case+'.log')).exists():raise SystemExit('replay output exists')
 p=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','180','bun',str(assets/'residual-grid.ts'),str(root/'source'),str(work),str(out)],capture_output=True,text=True)
 (root/(case+'.log')).write_text(p.stdout+p.stderr)
 assert p.returncode==0,p.stderr
 replay=json.loads(out.read_text())
 assert sorted(c['key'] for c in replay['connections'])==sorted(c['key'] for c in r['connections'])
 assert replay['input_sha256']==r['input_sha256'] and replay['settings']==r['settings']
 def record(prefix):return json.loads(next(l.removeprefix(prefix) for l in p.stdout.splitlines() if l.startswith(prefix)))
 census=record('GRID_CENSUS ');trials=record('TRIAL_TRACE ')
 for c in r['connections']:
  old=next(x for x in prior if x['case']==case and x['key']==c['key'])
  assert census[c['key']]=={k:v for k,v in old.items() if k not in ['case','net','key']}
  events=[t for t in trials if t['owner']==c['key']]
  byid={t['id']:t for t in events}
  for t in events:
   assert isinstance(t['ok'],bool)
   if t['parent'] is not None:assert t['parent'] in byid
  inserts=[t for t in events if t['kind']=='insertTrail']
  assert len(inserts)==old['stages'].get('trail-attempt',0)
  assert sum(not t['ok'] for t in inserts)==old['stages'].get('trail-legalise-rejected',0)+old['stages'].get('trail-empty',0)
  rows.append({'case':case,'key':c['key'],'net':c['netName'],'netId':c['net'],'ses_sha256':r['ses_sha256'],'trials':events})
 print(case+': session and all residual counters match',flush=True)
(root/'trial-results.json').write_text(json.dumps(rows,indent=2)+'\n')
