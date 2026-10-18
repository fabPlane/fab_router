"""python3 compare.py BASELINE_RUN CANDIDATE_RUN SOURCE_DIR OUTPUT_JSON"""
import hashlib
import json
from pathlib import Path
import statistics
import sys

before, after, source, output = map(Path, sys.argv[1:])
controls = [json.loads((p / 'controls.json').read_text()) for p in (before, after)]
for c in controls:
    assert c['complete'] and c['controls_preserved'], 'incomplete or modified controls'
for key in ('inputs_sha256', 'configs_sha256', 'harness_sha256', 'runtime_sha256', 'allowed_cpus', 'seeds', 'order'):
    assert controls[0][key] == controls[1][key], key
for name, expected in controls[1]['candidate']['source_sha256'].items():
    assert hashlib.sha256((source / name).read_bytes()).hexdigest() == expected, name
key = lambda r: (r['case'], r['seed'])
a, b = [sorted(json.loads((p / 'results.json').read_text()), key=key) for p in (before, after)]
assert len(a) == len(b) == 78
assert [key(r) for r in a] == [key(r) for r in b]
fields = ('passed', 'opens', 'new_errors', 'vias', 'length_mm')
differences = [{'case': x['case'], 'seed': x['seed'], 'fields': {f: [x[f], y[f]] for f in fields if x[f] != y[f]}}
               for x, y in zip(a, b) if any(x[f] != y[f] for f in fields)]
assert not differences, differences

def summary(rows):
    return dict(runs=len(rows), passed=sum(r['passed'] for r in rows),
                valid_cases_3of3=sum(all(r['passed'] for r in rows if r['case'] == c) for c in {r['case'] for r in rows}),
                opens=sum(r['opens'] for r in rows), new_errors=sum(r['new_errors'] for r in rows),
                median_route_s=statistics.median(r['seconds'] for r in rows))
data = dict(baseline_source=controls[0]['candidate']['commit'], candidate_source='cd3ba3f',
            candidate_recorded_head=controls[1]['candidate']['commit'],
            source_hashes_verified=True, controls_matched=True, before=summary(a), after=summary(b), differences=differences,
            source_sha256=controls[1]['candidate']['source_sha256'],
            cases=[dict(case=c, before=summary([r for r in a if r['case'] == c]), after=summary([r for r in b if r['case'] == c]))
                   for c in sorted({r['case'] for r in a})])
output.write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({k: data[k] for k in ('before', 'after', 'differences')}, indent=2))
