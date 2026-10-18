#!/usr/bin/env python3
"""Validate completed frozen runs and candidate source; emit compact comparison."""
import argparse, collections, hashlib, json, pathlib, statistics, subprocess
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('before', type=pathlib.Path)
parser.add_argument('after', type=pathlib.Path)
parser.add_argument('source', type=pathlib.Path)
parser.add_argument('output', type=pathlib.Path)
a = parser.parse_args()
load = lambda p: json.loads(p.read_text())
controls = [load(p/'controls.json') for p in (a.before, a.after)]
summaries = [load(p/'summary.json') for p in (a.before, a.after)]
for s in summaries:
    assert s['complete'] and s['controls_preserved'] and s['completed_runs'] == 78, s
keys = ['order', 'cases', 'seeds', 'inputs_sha256', 'configs_sha256', 'harness_sha256', 'runtime_sha256', 'runtime_source_sha256', 'allowed_cpus']
for key in keys:
    assert controls[0][key] == controls[1][key], key
for path, digest in controls[0]['candidate']['source_sha256'].items():
    data = subprocess.check_output(['git', '-C', str(a.source), 'show', '69cf598:'+path])
    assert hashlib.sha256(data).hexdigest() == digest, ('baseline', path)
for path, digest in controls[1]['candidate']['source_sha256'].items():
    assert hashlib.sha256((a.source/path).read_bytes()).hexdigest() == digest, ('candidate', path)
rows = [load(p/'results.json') for p in (a.before, a.after)]
index = lambda rs: {(r['case'], r['seed']): r for r in rs}
before, after = map(index, rows)
assert len(before) == len(after) == 78 and before.keys() == after.keys()
changed = []
for key, x in before.items():
    y = after[key]
    assert not x['passed'] or y['passed'], ('lost pass', key)
    assert y['opens'] <= x['opens'], ('added opens', key)
    assert y['new_errors'] <= x['new_errors'], ('added errors', key)
    if any(x[k] != y[k] for k in ['passed','opens','new_errors','vias','length_mm']):
        changed.append(dict(case=key[0], seed=key[1], before={k:x[k] for k in ['passed','opens','new_errors','vias','length_mm']}, after={k:y[k] for k in ['passed','opens','new_errors','vias','length_mm']}))
def totals(rs):
    cases = collections.defaultdict(list)
    for r in rs: cases[r['case']].append(r)
    return dict(cases=len(cases), runs=len(rs), passed=sum(r['passed'] for r in rs), valid_cases_3of3=sum(all(r['passed'] for r in v) and len(v)==3 for v in cases.values()), opens=sum(r['opens'] for r in rs), new_errors=sum(r['new_errors'] for r in rs), median_route_s=statistics.median(r['seconds'] for r in rs), new_error_types=dict(sum((collections.Counter(r['new_error_types']) for r in rs), collections.Counter())))
out = dict(before=totals(rows[0]), after=totals(rows[1]), changed_attempts=changed,
    per_case=[dict(case=case, **{label:[{k:r[k] for k in ['seed','passed','opens','new_errors','vias','length_mm','seconds']} for r in rs if r['case']==case] for label,rs in zip(['before','after'],rows)}) for case in sorted({r['case'] for r in rows[0]})],
    provenance=dict(before_directory=str(a.before),after_directory=str(a.after),baseline_commit=controls[0]['candidate']['commit'],candidate_recorded_commit=controls[1]['candidate']['commit'],source_hashes_verified=True,matched_controls=keys,candidate_source_sha256=controls[1]['candidate']['source_sha256']),
    limitations='Shared host, tests overlap candidate benchmark. Timing is descriptive, not an isolated speed claim. Independent branch excludes other pending fixes. Synthetic regression is not a frozen-board completion improvement.')
a.output.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['before','after','changed_attempts']},indent=2))
