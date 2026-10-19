#!/usr/bin/python3
"""Independently verify native reports, geometry-derived deltas and repeated decisions."""
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terminals', here / 'terminal-partitions.py')
terminals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terminals)

root = Path(sys.argv[1])
s = json.loads((root / 'summary.json').read_text())
count = 1 + 2*len(s['nearby'])
assert s['repeats'] == 3 and len(s['rows']) == 3*count
assert s['step_nm'] == round(s['stored_zone_gap_nm']/5)
for row in s['rows']:
    for name, digest in row['sha256'].items():
        assert hashlib.sha256((root / row['name'] / name).read_bytes()).hexdigest() == digest
    board = terminals.pcbnew.LoadBoard(str(root / row['name'] / 'board.kicad_pcb'))
    assert row['groups'] == terminals.partition(board), 'terminal groups differ from native board'
    report = json.loads((root / row['name'] / 'drc.json').read_text())
    assert row['errors'] == [e for e in report['violations'] if e['severity'] == 'error']
    assert row['opens'] == len(report['unconnected_items'])
    target = [e for e in report['violations'] if e['type'] == 'starved_thermal'
              and any(item['uuid'] == s['pad_uuid'] for item in e['items'])]
    assert row['target'] == target, 'target findings differ from native report'
    if row['label'] == 'baseline':
        assert target, 'supplied pad has no baseline thermal failure'
    if row['geometry']:
        rank, sign = row['label'].split('-')[1], int(row['label'].split('normal-')[1])
        track = s['nearby'][int(rank)-1]
        assert row['geometry']['track_uuid'] == track['uuid']
        assert row['geometry']['delta_nm'] == [round(sign*s['step_nm']*v) for v in track.get('direction', track['normal'])]
        assert abs(math.hypot(*row['geometry']['delta_nm'])-s['step_nm']) < 1
baseline = s['rows'][0]
errors = lambda row: Counter(json.dumps(e, sort_keys=True) for e in row['errors'])
for row in s['rows']:
    preserved = (row['groups'].keys() == baseline['groups'].keys()
                 and all(set(members) <= set(row['groups'].get(uid, []))
                         for uid, members in baseline['groups'].items()))
    expected = (not (errors(row)-errors(baseline)) and len(row['errors']) < len(baseline['errors'])
                and row['opens'] <= baseline['opens'] and preserved)
    assert row['eligible'] == expected
for repeat in range(3):
    trials = s['rows'][repeat*count:(repeat+1)*count]
    accepted = [r for r in trials if r['eligible']]
    winner = min(accepted, key=lambda r: (len(r['errors']), r['opens'], r['label'])) if accepted else trials[0]
    assert s['selections'][repeat] == winner['label']
for label in {r['label'] for r in s['rows']}:
    group = [r for r in s['rows'] if r['label'] == label]
    assert len(group) == 3
    for field in ('errors', 'opens', 'groups', 'eligible', 'geometry', 'target'):
        assert all(r[field] == group[0][field] for r in group)
assert len(set(s['selections'])) == 1
print(f'Verified {len(s["rows"])} native reports, all artifact hashes, geometric offsets and repeat consistency.')
