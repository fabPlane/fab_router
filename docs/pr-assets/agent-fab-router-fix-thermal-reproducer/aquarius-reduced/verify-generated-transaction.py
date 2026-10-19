#!/usr/bin/python3
"""Replay generated proposals and independently audit native acceptance evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import native
import transaction

generated = transaction.module('generated', 'generated-transaction.py')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('--source', type=Path, required=True)
a = p.parse_args()
s = json.loads((a.results/'summary.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
for name, expected in json.loads((a.results/'manifest.json').read_text()).items():
    assert sha((a.results/name).read_bytes()) == expected
for name, expected in s['input_sha256'].items():
    assert sha(Path(name).read_bytes()) == expected
nodes = native.parse(a.source.read_text())
count = 0

def verify(row):
    global count
    folder = a.results/row['name']
    report = json.loads((folder/'drc.json').read_text())
    assert row['errors'] == [v for v in report['violations'] if v['severity'] == 'error']
    assert row['opens'] == len(report['unconnected_items'])
    board = native.pcbnew.LoadBoard(str(folder/'board.kicad_pcb'))
    assert row['groups'] == transaction.terminals.partition(board)
    count += 1
    return board

for repeat in s['rows']:
    baseline = repeat['baseline']
    board = verify(baseline)
    pad = next(p for p in board.GetPads() if p.m_Uuid.AsString() == repeat['pad_uuid'])
    nearby = generated.geometry.nearby(board, pad, 1)
    assert nearby == repeat['nearby']
    gap = min(z.GetThermalReliefGap() for z in board.Zones()
              if z.GetNetCode() == pad.GetNetCode()
              and any(z.IsOnLayer(layer) for layer in pad.GetLayerSet().Seq()))
    assert gap == repeat['stored_gap_nm']
    candidates = list(generated.proposals(nodes, nearby[0], gap))
    accepted = []
    for attempt, (scale, delta, candidate) in zip(repeat['attempts'], candidates, strict=False):
        assert (attempt['scale'], attempt['delta_nm']) == (scale, delta)
        assert sha(candidate) == attempt['candidate_sha256']
        assert attempt['exception'] is None
        row = attempt['row']
        verify(row)
        expected = (transaction.errors(row) < transaction.errors(baseline)
                    and row['groups'].keys() == baseline['groups'].keys()
                    and not transaction.terminals.lost_pairs(baseline['groups'], row['groups'])
                    and row['opens'] <= baseline['opens'])
        assert expected == attempt['accepted']
        if expected:
            accepted.append(candidate)
    assert len(accepted) == 1 and repeat['attempts'][-1]['accepted']
    output = (a.results/f'selected-{repeat["repeat"]}.kicad_pcb').read_bytes()
    assert output == accepted[0] and sha(output) == repeat['selected_sha256']
assert len(s['rows']) == 3
print(f'PASS: {count} native reports/partitions; generated geometry and three selected boards replayed')
