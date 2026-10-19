"""Correlate exact-session replays with census keys; never infer residuals from insertion counters."""
import json,sys
from pathlib import Path
root=Path(sys.argv[1]);output=root/'residual-grid-correlation.json'
if output.exists():raise SystemExit('output must not exist')
census=json.loads((root/'grid-census.json').read_text())['attempts'];rows=[]
for p in sorted(root.glob('residual-*.json')):
    r=json.loads(p.read_text());case=p.stem.removeprefix('residual-');seed=r['settings']['seed']
    a=next(a for a in census if a['case']==case and a['seed']==seed)
    assert r['ses_sha256']==a['hashes']['board.ses'] and r['input_sha256']==a['hashes']['board.dsn']
    assert r['settings']==a['settings']
    for c in r['connections']:
        assert c['key'] in a['census']
        rows.append({'case':case,'seed':seed,'connection':c,**a['census'][c['key']]})
assert len(rows)==9
output.write_text(json.dumps(rows,indent=2)+'\n')
lines=['Final engine residuals, seed 1, from independent exact-SES replays. `Found` means a graph goal was reached, not that exact legalisation/insertion succeeded. These are existing stalls; no repair was attempted. All nine residual keys match their original observed routing calls.','', '| Case | Net | Connection key | Searches | Pop-limit exits | Graph goals found | Insertions | Coarsened |','|---|---|---|---:|---:|---:|---:|---:|']
for r in rows:
    lines.append(f"| {r['case']} | {r['connection']['netName']} | {r['connection']['key']} | {r['searches']} | {r['exhausted']} | {r['found']} | {r['inserted']} | {r['coarsened']} |")
(root/'residual-grid-tables.md').write_text('\n'.join(lines)+'\n')
