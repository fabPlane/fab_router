#!/usr/bin/python3
"""Replay proposal construction, saved designs, sidecars and complete native reports.

Does not rerun or authenticate DRC reports. Never treats saved-design drift as
an admissible causal witness. Original source nodes may not be removed.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'aquarius-reduced'))
import native
spec = importlib.util.spec_from_file_location('identity', HERE.parent / 'aquarius-reduced/design-identity.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--results', type=Path, nargs='+', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    original = args.input.read_bytes()
    nodes = native.parse(original.decode())
    original_signature = identity.design_signature(original)
    checks = []
    added = None
    seen = {}
    full_errors = {}
    for result in args.results:
        summary = json.loads((result/'summary.json').read_text())
        if added is None:
            added = summary['added']
        assert summary['added'] == added
        by_id = {item['uuid']: item['node'] for item in added}
        assert len(by_id) == len(added) == 9
        assert hashlib.sha256(original).hexdigest() in summary['source_sha256'].values()
        selections = {'original': [], 'all-added': list(by_id)}
        selections.update({f'only-{i}': [item] for i,item in enumerate(by_id)})
        selections.update({f'except-{i}': [other for other in by_id if other != item]
                           for i,item in enumerate(by_id)})
        selections.update({f'pair-{i}-{j}': [list(by_id)[i],list(by_id)[j]]
                           for i in range(9) for j in range(i+1,9)})
        labels = set()
        for row in summary['rows']:
            directory = result/row['name']
            labels.add(row['label'])
            assert row['selected'] == selections[row['label']], 'schedule attribution changed'
            assert row['name'] == str(row['repeat'])+'-'+row['label']
            candidate = (native.dump(nodes+[by_id[item] for item in row['selected']])+'\n').encode()
            proposal = gzip.decompress((directory/'proposal.kicad_pcb.gz').read_bytes())
            assert candidate == proposal, row['name']
            assert hashlib.sha256(proposal).hexdigest() == row['proposed_sha256']
            assert not (original_signature - identity.design_signature(proposal)), 'original node lost'
            board = (directory/'board.kicad_pcb').read_bytes()
            assert hashlib.sha256(board).hexdigest() == row['saved_sha256']
            saved = identity.design_signature(board)
            wanted = identity.design_signature(proposal)
            preserved = saved == wanted
            assert preserved == row['design_preserved']
            assert dict(removed=repr(wanted-saved), added=repr(saved-wanted)) == row['saved_design_drift']
            for ext in ('.kicad_pro', '.kicad_dru'):
                assert (directory/('board'+ext)).read_bytes() == args.input.with_suffix(ext).read_bytes()
            drc = json.loads((directory/'drc.json').read_text())
            errors = [error for error in drc['violations'] if error['severity'] == 'error']
            assert errors == row['errors']
            records = Counter(json.dumps(error, sort_keys=True) for error in errors)
            if row['label'] in full_errors:
                assert full_errors[row['label']] == records, 'complete native error records changed'
            full_errors[row['label']] = records
            assert len(drc['unconnected_items']) == row['opens']
            pads = sorted(item['uuid'] for error in errors if error['type'] == 'starved_thermal'
                          for item in error['items'] if item['description'].startswith('Pad '))
            check = dict(label=row['label'], repeat=row['repeat'], selected=row['selected'],
                         thermal_pads=pads, opens=row['opens'], errors=len(errors),
                         design_preserved=preserved, directory=str(directory))
            canonical = {key:value for key,value in check.items() if key not in ('repeat','directory')}
            if row['label'] in seen:
                assert seen[row['label']] == canonical, 'repeats changed'
            seen[row['label']] = canonical
            checks.append(check)
        assert len(summary['rows']) == 3*len(labels)
        for label in labels:
            assert sorted(row['repeat'] for row in summary['rows'] if row['label']==label) == [1,2,3]
    # Require all nine singleton probes and all 36 pair probes before asserting
    # a cardinality minimum among the nine generated items.
    assert {f'only-{i}' for i in range(9)} <= seen.keys()
    assert {f'pair-{i}-{j}' for i in range(9) for j in range(i+1,9)} <= seen.keys()
    pads = seen['all-added']['thermal_pads']
    findings = []
    for pad in pads:
        admissible = [check for check in checks if check['repeat']==1
                      and check['design_preserved'] and pad in check['thermal_pads']]
        minimum = min(len(check['selected']) for check in admissible)
        witnesses = [check for check in admissible if len(check['selected'])==minimum]
        findings.append(dict(pad=pad, minimum_admissible_added_items=minimum, witnesses=witnesses,
                             scope='intact original input plus subsets of nine generated items'))
    output = dict(production_fix=False, routing_benchmark=False,
                  checks=len(checks), distinct_schedules=len(seen),
                  saved_design_drifts=sum(not check['design_preserved'] for check in checks),
                  findings=findings, schedules=sorted(seen.values(),key=lambda row:row['label']))
    args.out.write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({key:value for key,value in output.items() if key!='schedules'},indent=2))


if __name__ == '__main__':
    main()
