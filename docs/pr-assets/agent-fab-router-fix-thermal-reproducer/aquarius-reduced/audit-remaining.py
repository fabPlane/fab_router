#!/usr/bin/python3
"""Audit bounded proposals against the four remaining composed-board failures."""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys
import native
import transaction

compose = transaction.module('compose_remaining', 'verify-composed.py')
generated = transaction.module('generated_remaining', 'generated-transaction.py')
reader = compose.compose.read


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--results', type=Path, required=True)
    p.add_argument('--source', type=Path, required=True)
    a = p.parse_args()
    # Independent report, partition, coverage and geometry-schedule replay.
    subprocess.run([sys.executable, str(Path(__file__).with_name('verify-generated-transaction.py')),
                    str(a.results), '--source', str(a.source)], check=True)
    summary = json.loads(reader(a.results/'summary.json'))
    source = a.source.read_bytes()
    assert source == reader(Path(__file__).parent/'composed-generated-results/selected-1.kicad_pcb')
    nodes = native.parse(source.decode())
    audited = {}
    targets = {}
    drift = {}
    for row in summary['rows']:
        baseline = row['baseline']
        assert len(baseline['errors']) == 4 and baseline['opens'] == 15
        cases = [(baseline, source)]
        candidates = generated.ranked_proposals(nodes, row['nearby'], row['stored_gap_nm'])
        reasons = Counter()
        removed_reasons = Counter()
        for attempt, (_, _, _, candidate) in zip(row['attempts'], candidates, strict=False):
            result = attempt['row']
            cases.append((result, candidate))
            added = transaction.errors(result) - transaction.errors(baseline)
            reasons.update('new:'+kind for kind in {json.loads(key)['type'] for key in added})
            if result['opens'] > baseline['opens']:
                reasons['increased_opens'] += 1
            if result['groups'].keys() != baseline['groups'].keys():
                reasons['terminal_inventory'] += 1
            if transaction.terminals.lost_pairs(baseline['groups'], result['groups']):
                reasons['lost_terminal_pairs'] += 1
            if any(e['type'] == 'starved_thermal' and any(
                    i['uuid'] == row['pad_uuid'] for i in e['items']) for e in result['errors']):
                reasons['target_thermal_remains'] += 1
            else:
                removed_reasons['target_removed'] += 1
                removed_reasons.update('new:'+kind for kind in {json.loads(key)['type'] for key in added})
        for result, expected in cases:
            name = result['name']
            if name in audited:
                assert audited[name] == expected
                continue
            folder = a.results/name
            checked = compose.design_signature(reader(folder/'board.kicad_pcb'))
            proposed = compose.design_signature(expected)
            if checked != proposed:
                # Failed checks may rewrite shorted-track net assignments. Never
                # permit this for a baseline or an accepted candidate.
                attempt = next((x for x in row['attempts'] if x['row']['name'] == name), None)
                assert attempt is not None and not attempt['accepted']
                drift[name] = dict(checked_only=repr(checked-proposed), proposed_only=repr(proposed-checked))
            for ext in ('.kicad_pro', '.kicad_dru'):
                assert reader(folder/('board'+ext)) == a.source.with_suffix(ext).read_bytes()
            audited[name] = expected
        targets.setdefault(row['pad_uuid'], []).append(dict(repeat=row['repeat'],
            proposals=len(row['attempts']), accepted=row['accepted'], reasons=dict(reasons), target_removed_reasons=dict(removed_reasons)))
    for rows in targets.values():
        assert [r['repeat'] for r in rows] == [1, 2, 3]
        assert len({json.dumps({k:v for k,v in r.items() if k != 'repeat'}, sort_keys=True) for r in rows}) == 1
    result = dict(production_fix=False, routing_benchmark=False, native_checks=len(audited), rejected_design_drift=drift, targets=targets)
    print(json.dumps(result, indent=2))
    (a.results/'audit.json').write_text(json.dumps(result, indent=2)+'\n')


if __name__ == '__main__':
    main()
