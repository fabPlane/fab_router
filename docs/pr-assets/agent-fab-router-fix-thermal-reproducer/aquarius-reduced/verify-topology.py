#!/usr/bin/python3
"""Independently verify native reports, geometry-derived deltas and repeated decisions."""
from collections import Counter
import hashlib
import gzip
import tempfile
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
count = 1 + 4*len(s['nearby'])
assert s['repeats'] == 3 and len(s['rows']) == 3*count
assert s['step_nm'] == s['stored_zone_gap_nm']
def board_bytes(path):
    return path.read_bytes() if path.exists() else gzip.decompress(path.with_suffix(path.suffix+'.gz').read_bytes())


def load_board(path):
    if path.exists():
        return terminals.pcbnew.LoadBoard(str(path))
    with tempfile.TemporaryDirectory(prefix='thermal-topology-') as tmp:
        staged = Path(tmp)/'board.kicad_pcb'
        staged.write_bytes(board_bytes(path))
        return terminals.pcbnew.LoadBoard(str(staged))


for row in s['rows']:
    for name, digest in row['sha256'].items():
        assert hashlib.sha256(board_bytes(root / row['name'] / name)).hexdigest() == digest
    board = load_board(root / row['name'] / 'board.kicad_pcb')
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
        assert abs(math.hypot(*row['geometry']['delta_nm'])-abs(sign)*s['step_nm']) < 1
spec = importlib.util.spec_from_file_location('topology', here / 'topology-doglegs.py')
topology = importlib.util.module_from_spec(spec)
spec.loader.exec_module(topology)
source = next(Path(name) for name in s['input_sha256'] if name.endswith('.kicad_pcb'))
for name, digest in s['input_sha256'].items():
    assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == digest
board = terminals.pcbnew.LoadBoard(str(source))
pad = next(p for p in board.GetPads() if p.m_Uuid.AsString() == s['pad_uuid'])
tracks, metrics = topology.topology(board, pad, s['stored_zone_gap_nm'])
assert metrics == s['topology']
assert tracks == [{k:v for k,v in t.items() if k != 'direction'} for t in s['nearby']]
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
    for field in ('errors', 'target'):
        assert all(Counter(json.dumps(e, sort_keys=True) for e in r[field]) == Counter(json.dumps(e, sort_keys=True) for e in group[0][field]) for r in group)
    for field in ('opens', 'groups', 'eligible', 'geometry'):
        assert all(r[field] == group[0][field] for r in group)
assert len(set(s['selections'])) == 1
print(f'Verified {len(s["rows"])} native reports, all artifact hashes, geometric offsets and repeat consistency.')
