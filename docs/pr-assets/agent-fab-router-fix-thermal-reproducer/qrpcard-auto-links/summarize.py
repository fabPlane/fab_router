#!/usr/bin/env python3
"""Summarize static native searches; these are not router benchmark scores."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
report = json.loads((a.results / 'summary.json').read_text())
rows = []
for run in report['rows']:
    baseline = Counter(json.dumps(e, sort_keys=True) for e in run['baseline']['errors'])
    baseline_opens = run['baseline']['opens']
    rejected = Counter()
    for attempt in run['attempts']:
        if attempt['accepted']:
            baseline = Counter(json.dumps(e, sort_keys=True) for e in attempt['row']['errors'])
            baseline_opens = attempt['row']['opens']
            continue
        row = attempt['row']
        if attempt['exception']:
            rejected['checker_exception:' + attempt['exception']] += 1
            continue
        errors = Counter(json.dumps(e, sort_keys=True) for e in row['errors'])
        # These counts overlap: one candidate may violate multiple guards.
        if not errors < baseline:
            rejected['not_strict_error_subset'] += 1
        for error in (errors - baseline):
            rejected['new_' + json.loads(error)['type']] += 1
        if row['opens'] > baseline_opens:
            rejected['increased_opens'] += 1
    rows.append(dict(before_errors=len(run['baseline']['errors']),
                     after_errors=len(run['final']['errors']),
                     before_opens=run['baseline']['opens'],
                     after_opens=run['final']['opens'],
                     checked_candidates=len(run['attempts']),
                     accepted_candidates=sum(x['accepted'] for x in run['attempts']),
                     stop=run['stop'], skipped=run['skipped'],
                     selected_sha256=run['selected_sha256'],
                     rejected_reasons=dict(sorted(rejected.items()))))
    selected = a.results / f'repeat-{len(rows)}' / 'selected.kicad_pcb'
    assert hashlib.sha256(selected.read_bytes()).hexdigest() == run['selected_sha256']
    before, after = run['baseline']['groups'], run['final']['groups']
    assert before.keys() == after.keys()
    assert all(set(group).issubset(after[key]) for key, group in before.items())
    rows[-1]['lost_connected_pairs'] = 0
out = dict(routing_benchmark=False, production_fix=False,
           input_sha256=report['input_sha256'], budget=report['budget'], repeats=rows)
a.output.write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(rows, indent=2))
