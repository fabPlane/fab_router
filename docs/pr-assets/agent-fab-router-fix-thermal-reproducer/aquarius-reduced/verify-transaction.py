#!/usr/bin/python3
"""Independently bind transaction decisions to saved native reports and boards."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import native
import transaction

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('--source', type=Path, required=True)
a = p.parse_args()
s = json.loads((a.results/'summary.json').read_text())
original = a.source.read_bytes()
for name, expected in s['input_sha256'].items():
    assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == expected

def verify_row(row):
    folder = a.results/row['name']
    report = json.loads((folder/'drc.json').read_text())
    errors = [v for v in report['violations'] if v['severity'] == 'error']
    assert errors == row['errors']
    assert len(report['unconnected_items']) == row['opens']
    groups = transaction.terminals.partition(native.pcbnew.LoadBoard(str(folder/'board.kicad_pcb')))
    assert groups == row['groups']
    return groups

base = s['baseline']
verify_row(base)
accepted, rejected = 0, 0
for row in s['rows']:
    if row.get('exception'):
        assert row['exception'] in ('TimeoutError', 'RuntimeError')
        assert row['byte_rollback'] and not row['accepted']
        rejected += 1
        continue
    detail = row['row']
    groups = verify_row(detail)
    expected = (transaction.errors(detail) < transaction.errors(base)
                and groups.keys() == base['groups'].keys()
                and not transaction.terminals.lost_pairs(base['groups'], groups)
                and detail['opens'] <= base['opens'])
    assert expected == row['accepted']
    published = (a.results/(row['name']+'.kicad_pcb')).read_bytes()
    assert hashlib.sha256(published).hexdigest() == row['output_sha256']
    if expected:
        assert hashlib.sha256(published).hexdigest() == row['candidate_sha256']
        assert not detail['errors'] and groups == base['groups']
        accepted += 1
    else:
        assert published == original and row['byte_rollback']
        rejected += 1
assert (accepted, rejected) == (3, 15)
print('PASS: 13 native reports/partitions, 12 published boards, 18 decisions; accepted 3, rejected 15')
