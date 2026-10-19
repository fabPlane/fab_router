#!/usr/bin/env python3
"""Describe the bounded static search, including every accepted stage and blocker.

Reads retained evidence only; does not execute DRC or produce router scores.
"""
import argparse
from collections import Counter
import json
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
summary = json.loads((a.results / 'summary.json').read_text())
rows = []
for repeat, run in enumerate(summary['rows'], 1):
    current = run['baseline']
    accepted = []
    rejected_reasons = Counter()
    lower_error_rejections = []
    for attempt in run['attempts']:
        if not attempt['accepted']:
            row = attempt['row']
            if attempt['exception']:
                rejected_reasons['checker_exception:'+attempt['exception']] += 1
                continue
            before_errors = Counter(json.dumps(e, sort_keys=True) for e in current['errors'])
            after_errors = Counter(json.dumps(e, sort_keys=True) for e in row['errors'])
            lost = sum(len(set(group)-set(row['groups'].get(key, [])))
                       for key, group in current['groups'].items())
            reasons = []
            if not after_errors < before_errors:
                reasons.append('not_strict_error_subset')
            if current['groups'].keys() != row['groups'].keys():
                reasons.append('terminal_inventory')
            if lost:
                reasons.append('lost_connected_terminal_pairs')
            if row['opens'] > current['opens']:
                reasons.append('increased_opens')
            assert reasons, 'rejection must have a recorded blocker'
            rejected_reasons.update(reasons)
            if len(row['errors']) < len(current['errors']):
                lower_error_rejections.append(dict(candidate=attempt['name'],
                    current_errors=len(current['errors']), candidate_errors=len(row['errors']),
                    current_opens=current['opens'], candidate_opens=row['opens'],
                    lost_directed_terminal_relations=lost, reasons=reasons))
            continue
        after = attempt['row']
        prior_errors = Counter(json.dumps(e, sort_keys=True) for e in current['errors'])
        after_errors = Counter(json.dumps(e, sort_keys=True) for e in after['errors'])
        assert after_errors < prior_errors
        assert after['opens'] <= current['opens']
        assert after['groups'].keys() == current['groups'].keys()
        assert all(set(group).issubset(after['groups'][key]) for key, group in current['groups'].items())
        target = sorted({item['description'] for error in current['errors']
                         for item in error['items'] if item['uuid'] == attempt['target']})
        accepted.append(dict(candidate=attempt['name'], target=target,
                             metadata=attempt['metadata'],
                             before_errors=len(current['errors']), after_errors=len(after['errors']),
                             before_opens=current['opens'], after_opens=after['opens'],
                             removed_errors=[json.loads(e) for e in (prior_errors-after_errors).elements()]))
        current = after
    assert current == run['final']
    checked = [x['row'] for x in run['attempts'] if x['row'] is not None]
    rows.append(dict(repeat=repeat, accepted=accepted,
                     checked_candidates=len(run['attempts']),
                     attempted_targets=dict(Counter(x['target'] for x in run['attempts'])),
                     skipped=run['skipped'], stop=run['stop'],
                     exceptions=dict(Counter(x['exception'] for x in run['attempts'] if x['exception'])),
                     rejected_reasons=dict(sorted(rejected_reasons.items())),
                     lower_error_rejections=lower_error_rejections,
                     remaining_errors=current['errors'],
                     lowest_observed_error_count=min(len(r['errors']) for r in checked),
                     selected_sha256=run['selected_sha256']))
assert len({json.dumps({k:v for k,v in row.items() if k!='repeat'},sort_keys=True) for row in rows}) == 1
out = dict(production_fix=False, routing_benchmark=False, budget=summary['budget'], rows=rows)
a.output.write_text(json.dumps(out, indent=2)+'\n')
print(json.dumps(out, indent=2))
