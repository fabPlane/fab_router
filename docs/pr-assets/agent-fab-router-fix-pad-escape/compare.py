"""Compare two complete native sweeps and verify candidate source identity.
Usage: python3 compare.py BEFORE_RESULTS_DIR AFTER_RESULTS_DIR ROUTER_SOURCE_DIR
Writes benchmark-summary.json next to this script. No raw benchmark files are modified.
"""
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import sys

before, after, source = map(Path, sys.argv[1:4])
a = json.loads((before / 'results.json').read_text())
b = json.loads((after / 'results.json').read_text())
ac = json.loads((before / 'controls.json').read_text())
bc = json.loads((after / 'controls.json').read_text())
assert ac['complete'] and ac['controls_preserved']
assert bc['complete'] and bc['controls_preserved']
for key in ['inputs_sha256', 'configs_sha256', 'harness_sha256', 'runtime_sha256', 'allowed_cpus', 'seeds', 'order']:
    assert ac[key] == bc[key], key
for name, expected in bc['candidate']['source_sha256'].items():
    assert hashlib.sha256((source / name).read_bytes()).hexdigest() == expected, name
key = lambda r: (r['case'], r['seed'])
a = sorted(a, key=key); b = sorted(b, key=key)
assert len(a) == len(b) == 78
assert [key(r) for r in a] == [key(r) for r in b]

def summary(rows):
    return {
        'runs': len(rows), 'passed': sum(r['passed'] for r in rows),
        'valid_cases_3of3': sum(len(rs := [r for r in rows if r['case'] == c]) == 3 and all(r['passed'] for r in rs) for c in {r['case'] for r in rows}),
        'opens': sum(r['opens'] for r in rows), 'new_errors': sum(r['new_errors'] for r in rows),
        'median_route_s': statistics.median(r['seconds'] for r in rows),
        'median_vias': statistics.median(r['vias'] for r in rows),
        'median_length_mm': statistics.median(r['length_mm'] for r in rows),
    }
fields = ['passed', 'opens', 'new_errors', 'vias', 'length_mm']
differences = [{'case': x['case'], 'seed': x['seed'], 'fields': {k: [x[k], y[k]] for k in fields if x[k] != y[k]}}
               for x, y in zip(a, b) if any(x[k] != y[k] for k in fields)]
regressions = [{'case': x['case'], 'seed': x['seed']} for x, y in zip(a, b)
               if (x['passed'] and not y['passed']) or y['opens'] > x['opens'] or y['new_errors'] > x['new_errors']]
data = {
    'before_commit': ac['candidate']['commit'],
    'candidate_recorded_head': bc['candidate']['commit'],
    'verified_source_commit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip(),
    'candidate_source_hashes_verified': True, 'controls_matched': True,
    'before': summary(a), 'after': summary(b), 'regressions': regressions,
    'differences': differences, 'source_sha256': bc['candidate']['source_sha256'],
    'cases': [{'case': c, 'before': summary([r for r in a if r['case'] == c]), 'after': summary([r for r in b if r['case'] == c])}
              for c in sorted({r['case'] for r in a})],
}
Path(__file__).with_name('benchmark-summary.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({k: data[k] for k in ['before', 'after', 'regressions']}, indent=2))
