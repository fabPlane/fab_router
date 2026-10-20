"""Verify all 78 diagnostic native results against the prior control before writing evidence."""
import hashlib
import json
from pathlib import Path
from statistics import median
import sys
control, observed, source, output = map(lambda x: Path(x).resolve(), sys.argv[1:])
if output.exists():
    raise SystemExit('output must not exist')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
old = {}
for p in sorted(control.glob('*/results.json')):
    for row in json.loads(p.read_text()):
        key = (row['case'],row['seed'])
        assert key not in old
        old[key] = (row,p.parent)
new = json.loads((observed/'results.json').read_text())
assert len(new) == len(old) == 78
assert len({(r['case'],r['seed']) for r in new}) == 78
rows=[]
for r in new:
    b, base = old[(r['case'],r['seed'])]
    before, after = base/b['evidence'], observed/r['evidence']
    for field in ['status','passed','vias','length_mm','opens','new_errors','new_error_types','failed_fidelity']:
        assert r[field] == b[field], (r['case'],r['seed'],field)
    hashes={}
    for name in ['board.dsn','candidate-settings.json','dsn-manifest.json','board.ses']:
        hashes[name] = sha(after/'work'/name)
        assert hashes[name] == sha(before/'work'/name), (r['case'],r['seed'],name)
    summaries=[json.loads((p/'work/router-summary.json').read_text()) for p in [before,after]]
    assert summaries[0]['settings'] == summaries[1]['settings']
    for field in ['statsBefore','statsAfter']:
        assert summaries[0]['result'][field] == summaries[1]['result'][field]
    lines=[s.removeprefix('GRID_CENSUS ') for s in (after/'route.stdout.log').read_text().splitlines() if s.startswith('GRID_CENSUS ')]
    assert len(lines)==1
    census=json.loads(lines[0])
    for c in census.values():
        assert c['coarsened'] <= c['regions'] and c['exhausted'] <= c['searches']
        assert sum(c['resolutions'].values()) == c['regions']
    rows.append({**{k:r[k] for k in ['case','seed','passed','opens','new_errors','vias','length_mm']},
        'before_seconds':b['seconds'],'diagnostic_seconds':r['seconds'], 'hashes':hashes,
        'settings':summaries[1]['settings'], 'report':summaries[1]['result']['report'], 'census':census})
provenance=json.loads((source/'census-provenance.json').read_text())
assert provenance['instrumented_passes_sha256']==sha(source/'src/route/passes.ts')
output.mkdir()
(output/'grid-census.json').write_text(json.dumps({'scope':'Diagnostic counters; timing includes overhead. Not a relaxation experiment or improvement.', 'provenance':provenance,'attempts':rows},indent=2)+'\n')
fields=['calls','inserted','regions','coarsened','searches','pops','found','exhausted']
cases=[]
for case in sorted({r['case'] for r in rows}):
    rr=[r for r in rows if r['case']==case]
    assert len(rr)==3
    cc={f:sum(c[f] for r in rr for c in r['census'].values()) for f in fields}
    never=[c for r in rr for c in r['census'].values() if c['inserted']==0]
    cc['never_inserted']={f:sum(c[f] for c in never) for f in fields}
    cases.append({'case':case, 'before_median_s':median(r['before_seconds'] for r in rr),
        'diagnostic_median_s':median(r['diagnostic_seconds'] for r in rr),
        'before_p95_s':max(r['before_seconds'] for r in rr),'diagnostic_p95_s':max(r['diagnostic_seconds'] for r in rr),
        'passed':sum(r['passed'] for r in rr),'opens':sum(r['opens'] for r in rr),
        'new_errors':sum(r['new_errors'] for r in rr),**cc})
(output/'grid-summary.json').write_text(json.dumps(cases,indent=2)+'\n')
lines=['Counts sum three seeds per case. `Never inserted` means a connection key never returned a successful insertion during observed calls; it is NOT a final residual-connectivity count. Counters cover calls inside routeConnection only. The pop-limit count excludes frontier exhaustion and timeout unless the pop limit was also exceeded. Instrumented timing is diagnostic overhead, not a speed comparison.', '', '| Case | Opens (both) | Native errors (both) | Regions | Coarsened | Searches | Pop-limit exits | Never-inserted pop-limit exits | Before median/p95 s | Diagnostic median/p95 s |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
for c in cases:
    lines.append(f"| {c['case']} | {c['opens']} | {c['new_errors']} | {c['regions']} | {c['coarsened']} | {c['searches']} | {c['exhausted']} | {c['never_inserted']['exhausted']} | {c['before_median_s']:.3f}/{c['before_p95_s']:.3f} | {c['diagnostic_median_s']:.3f}/{c['diagnostic_p95_s']:.3f} |")
(output/'grid-tables.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'all_78_session_and_quality_match':True,'totals':{f:sum(c[f] for c in cases) for f in fields},'cases':len(cases),'passed':sum(r['passed'] for r in rows),'opens':sum(r['opens'] for r in rows),'new_errors':sum(r['new_errors'] for r in rows)},indent=2))
