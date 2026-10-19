#!/usr/bin/python3
"""Isolate the adverse dogleg's new clearance error; static native diagnostic only."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import native

HERE = Path(__file__).resolve().parent
TRACK = '917bc58f-bf38-4e94-917f-0fa6c8a519d8'
PAD = '9ed9deec-e5aa-43e2-8257-ea9e272f0724'

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(exist_ok=False, parents=True)
    native.D = a.out
    source = HERE / 'selection-results'
    baseline = source / 'baseline-1' / 'board.kicad_pcb'
    adverse = source / 'track-3-offset--1-1' / 'board.kicad_pcb'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    inputs = {str(f.relative_to(HERE)): sha(f) for b in (baseline, adverse)
              for f in (b, b.with_suffix('.kicad_pro'), b.with_suffix('.kicad_dru'))}
    base = native.parse(baseline.read_text())
    bad = native.parse(adverse.read_text())
    original = next(n for n in base if isinstance(n, list) and native.uid(n) == TRACK)
    restored = copy.deepcopy(bad)
    moved = next(n for n in restored if isinstance(n, list) and native.uid(n) == TRACK)
    # Restore only endpoints, retaining every other tree including both endpoint links.
    for key in ('start', 'end'):
        native.child(moved, key)[1:] = native.child(original, key)[1:]
    rows = []
    for repeat in range(1, 4):
        for label, nodes, board in [('baseline', base, baseline), ('adverse', bad, adverse),
                                    ('restore-segment-keep-links', restored, adverse)]:
            native.SRC = board
            row = native.check(nodes, f'{label}-{repeat}')
            row['label'] = label
            row['pair_errors'] = [e for e in row['errors'] if e['type'] == 'clearance'
                and {i['uuid'] for i in e['items']} == {TRACK, PAD}]
            assert len(row['pair_errors']) == (1 if label == 'adverse' else 0)
            directory = a.out / row['name']
            row['sha256'] = {f.name: sha(f) for f in directory.iterdir()
                             if f.is_file() and f.suffix != '.kicad_prl'}
            rows.append(row)
    for label in {r['label'] for r in rows}:
        repeated = [r for r in rows if r['label'] == label]
        assert all(r['errors'] == repeated[0]['errors'] and r['opens'] == repeated[0]['opens'] for r in repeated)
    assert inputs == {name: sha(HERE / name) for name in inputs}
    (a.out / 'summary.json').write_text(json.dumps(dict(production_fix=False,
        routing_benchmark=False, native_version=native.pcbnew.Version(), repeats=3,
        track_uuid=TRACK, pad_uuid=PAD, input_sha256=inputs, rows=rows), indent=2)+'\n')

if __name__ == '__main__':
    main()
