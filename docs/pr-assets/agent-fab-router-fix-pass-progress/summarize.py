"""Summarize full native runs and audit source/control identity."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import statistics
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('before', type=Path)
parser.add_argument('after', type=Path)
parser.add_argument('--source-commit', default='HEAD')
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
controls = [json.loads((p / 'controls.json').read_text()) for p in [args.before, args.after]]
runs = [json.loads((p / 'results.json').read_text()) for p in [args.before, args.after]]
keys = ['version', 'order', 'routers', 'cases', 'seeds', 'smoke', 'full_suite',
        'inputs_sha256', 'configs_sha256', 'harness_sha256', 'runtime_sha256',
        'runtime_source_sha256', 'allowed_cpus']
audit = {k: controls[0][k] == controls[1][k] for k in keys}
assert all(audit.values()), audit
source = controls[1]['candidate']['source_sha256']
for file, digest in source.items():
    blob = subprocess.check_output(['git', 'show', f'{args.source_commit}:{file}'], cwd=root)
    assert hashlib.sha256(blob).hexdigest() == digest, file

def summarize(rows):
    by_case = defaultdict(list)
    for row in rows:
        by_case[row['case']].append(row)
    assert len(by_case) == 26 and len(rows) == 78
    return {'cases': 26, 'runs': len(rows), 'passed': sum(r['passed'] for r in rows),
            'valid_cases_3of3': sum(len(rs) == 3 and all(r['passed'] for r in rs) for rs in by_case.values()),
            'opens': sum(r['opens'] for r in rows), 'new_drc_errors': sum(r['new_errors'] for r in rows),
            'median_route_s': statistics.median(r['seconds'] for r in rows)}

def compact(rows):
    return [{k: r[k] for k in ['case', 'seed', 'passed', 'opens', 'new_errors', 'vias', 'length_mm', 'seconds']} for r in rows]

before, after = [{(r['case'], r['seed']): r for r in rs} for rs in runs]
changes = []
for key, r in before.items():
    fields = ['passed', 'opens', 'new_errors', 'vias', 'length_mm']
    delta = {f: [r[f], after[key][f]] for f in fields if r[f] != after[key][f]}
    if delta:
        changes.append({'case': key[0], 'seed': key[1], 'changes': delta})
print(json.dumps({'baseline_commit': controls[0]['candidate']['commit'],
                  'tested_source_commit': args.source_commit,
                  'harness_captured_candidate_commit': controls[1]['candidate']['commit'],
                  'source_hashes_verified': len(source), 'control_audit': audit,
                  'before': summarize(runs[0]), 'after': summarize(runs[1]),
                  'changed_outcomes_or_copper': changes,
                  'attempts_before': compact(runs[0]), 'attempts_after': compact(runs[1])}, indent=2))
