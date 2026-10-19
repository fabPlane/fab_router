#!/usr/bin/python3
"""Replay generated proposals and independently audit native acceptance evidence."""
import argparse
import hashlib
import gzip
import json
from pathlib import Path
import native
import transaction

generated = transaction.module('generated', 'generated-transaction.py')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('--source', type=Path, required=True)
a = p.parse_args()
def read_json(path):
    data = path.read_bytes() if path.exists() else gzip.decompress(path.with_suffix(path.suffix+'.gz').read_bytes())
    return json.loads(data)

s = read_json(a.results/'summary.json')
track_limit = s.get('track_limit', 1)
assert type(track_limit) is int and 1 <= track_limit <= 8
sha = lambda data: hashlib.sha256(data).hexdigest()
for name, expected in json.loads((a.results/'manifest.json').read_text()).items():
    assert sha((a.results/name).read_bytes()) == expected
for name, expected in s['input_sha256'].items():
    assert sha(a.source.with_suffix(Path(name).suffix).read_bytes()) == expected
nodes = native.parse(a.source.read_text())
count = 0

def verify(row):
    global count
    folder = a.results/row['name']
    report = read_json(folder/'drc.json')
    assert row['errors'] == [v for v in report['violations'] if v['severity'] == 'error']
    assert row['opens'] == len(report['unconnected_items'])
    path = folder/'board.kicad_pcb'
    if not path.exists():
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            expanded = Path(tmp)/'board.kicad_pcb'
            expanded.write_bytes(gzip.decompress(path.with_suffix('.kicad_pcb.gz').read_bytes()))
            board = native.pcbnew.LoadBoard(str(expanded))
    else:
        board = native.pcbnew.LoadBoard(str(path))
    assert row['groups'] == transaction.terminals.partition(board)
    count += 1
    return board

for repeat in s['rows']:
    baseline = repeat['baseline']
    board = verify(baseline)
    pads = {p.m_Uuid.AsString(): p for p in board.GetPads()}
    targets = sorted({item['uuid'] for error in baseline['errors']
                      if error['type'] == 'starved_thermal' for item in error['items']
                      if item['uuid'] in pads})
    assert repeat['pad_uuid'] in targets
    if s.get('all_targets'):
        assert repeat['pad_uuid'] == targets[repeat['target_index']]
        assert sorted(r['pad_uuid'] for r in s['rows'] if r['repeat'] == repeat['repeat']) == targets
    pad = pads[repeat['pad_uuid']]
    nearby = generated.geometry.nearby(board, pad, track_limit)
    assert nearby == repeat['nearby']
    gap = min(z.GetThermalReliefGap() for z in board.Zones()
              if z.GetNetCode() == pad.GetNetCode()
              and any(z.IsOnLayer(layer) for layer in pad.GetLayerSet().Seq()))
    assert gap == repeat['stored_gap_nm']
    candidates = list(generated.ranked_proposals(nodes, nearby, gap))
    accepted = []
    for attempt, (rank, scale, delta, candidate) in zip(repeat['attempts'], candidates, strict=False):
        assert attempt.get('track_rank', 1) == rank
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
    assert len(repeat['attempts']) == (len(candidates) if not accepted else next(i+1 for i, a in enumerate(repeat['attempts']) if a['accepted']))
    assert len(accepted) == int(repeat['accepted'])
    name = f'selected-{repeat["repeat"]}-{repeat["target_index"]}.kicad_pcb' if s.get('all_targets') else f'selected-{repeat["repeat"]}.kicad_pcb'
    path = a.results/name
    output = path.read_bytes() if path.exists() else gzip.decompress(path.with_suffix('.kicad_pcb.gz').read_bytes())
    assert output == (accepted[0] if accepted else a.source.read_bytes())
    assert sha(output) == repeat['selected_sha256']
for target in {r['pad_uuid'] for r in s['rows']}:
    group = [r for r in s['rows'] if r['pad_uuid'] == target]
    assert sorted(r['repeat'] for r in group) == [1, 2, 3]
    assert len({r['selected_sha256'] for r in group}) == 1
print(f'PASS: {count} native reports/partitions; generated geometry, target coverage and selected boards replayed')
