#!/usr/bin/python3
"""Fixture-specific bounded dogleg selection; no production routing or safety claim."""
import argparse
import copy
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import uuid
import native

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terminals', HERE / 'terminal-partitions.py')
terminals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terminals)


def eligible(before, candidate):
    """Require strict native error removal, no new errors, opens or terminal loss."""
    errors = lambda row: Counter(json.dumps(e, sort_keys=True) for e in row['errors'])
    old, new = errors(before), errors(candidate)
    return (not (new - old) and sum(new.values()) < sum(old.values())
            and candidate['opens'] <= before['opens']
            and candidate['groups'].keys() == before['groups'].keys()
            and not terminals.lost_pairs(before['groups'], candidate['groups']))


def controls():
    base = dict(errors=[{'type': 'thermal'}, {'type': 'other'}], opens=1,
                groups={'a': ['a', 'b'], 'b': ['a', 'b']})
    good = copy.deepcopy(base)
    good['errors'].pop()
    assert eligible(base, good)
    bad = copy.deepcopy(good)
    bad['errors'] = [{'type': 'new'}]
    assert not eligible(base, bad)
    bad = copy.deepcopy(good)
    bad['opens'] += 1
    assert not eligible(base, bad)
    bad = copy.deepcopy(good)
    bad['groups'] = {'a': ['a'], 'b': ['b']}
    assert not eligible(base, bad)
    assert not eligible(base, base)
    # Multiset comparison must reject a duplicated surviving error.
    bad = copy.deepcopy(good)
    bad['errors'] *= 2
    assert not eligible(base, bad)
    return 6


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D = a.source, a.out
    assert native.pcbnew.Version() == '10.0.6'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    inputs = {str(path): sha(path) for path in (a.source, a.source.with_suffix('.kicad_pro'), a.source.with_suffix('.kicad_dru'))}
    base = native.parse(a.source.read_text())
    fixture = native.parse((HERE / 'board.kicad_pcb').read_text())
    tracks = [n for n in fixture if isinstance(n, list) and n[0] == 'segment']
    rows, selections = [], []
    for repeat in range(1, 4):
        trials = []
        # Fixed bounded candidate set, generated before inspecting any candidate DRC.
        for index, sign in [(None, 0), (1, -1), (1, 1), (2, -1), (2, 1)]:
            nodes = copy.deepcopy(base)
            label = 'baseline' if index is None else f'track-{index+1}-offset-{sign}'
            if index is not None:
                original = next(n for n in base if isinstance(n, list) and native.uid(n) == native.uid(tracks[index]))
                track = next(n for n in nodes if isinstance(n, list) and native.uid(n) == native.uid(original))
                c, s = math.cos(math.radians(-315)), math.sin(math.radians(-315))
                vector = (c, s) if index == 1 else (-s, c)
                delta = tuple(round(v * sign * 100000) for v in vector)
                for key in ('start', 'end'):
                    before, after = native.child(original, key), native.child(track, key)
                    after[1:] = [f'{float(before[axis+1])+delta[axis]/1e6:.6f}' for axis in (0, 1)]
                    link = copy.deepcopy(original)
                    native.child(link, 'start')[1:] = before[1:]
                    native.child(link, 'end')[1:] = after[1:]
                    native.child(link, 'uuid')[1] = '"' + str(uuid.uuid5(uuid.NAMESPACE_URL, f'select-dogleg-{label}-{key}')) + '"'
                    nodes.append(link)
                restored = copy.deepcopy(nodes[:-2])
                restored[nodes.index(track)] = copy.deepcopy(original)
                assert restored == base
            row = native.check(nodes, f'{label}-{repeat}')
            directory = a.out / row['name']
            board = native.pcbnew.LoadBoard(str(directory / 'board.kicad_pcb'))
            row['groups'] = terminals.partition(board)
            row['label'] = label
            row['sha256'] = {f.name: sha(f) for f in directory.iterdir() if f.is_file() and f.suffix != '.kicad_prl'}
            trials.append(row)
        before = trials[0]
        for row in trials:
            row['eligible'] = eligible(before, row)
        accepted = [r for r in trials if r['eligible']]
        winner = min(accepted, key=lambda r: (len(r['errors']), r['opens'], r['label'])) if accepted else before
        selections.append(dict(repeat=repeat, selected=winner['label'], errors=len(winner['errors']), opens=winner['opens']))
        rows.extend(trials)
    assert len({json.dumps({k:v for k,v in r.items() if k != 'repeat'}, sort_keys=True) for r in selections}) == 1
    assert all(r['selected'] == 'track-2-offset-1' and r['errors'] == 5 and r['opens'] == 15 for r in selections)
    assert inputs == {name: sha(Path(name)) for name in inputs}
    (a.out / 'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        native_version=native.pcbnew.Version(), controls=controls(), repeats=3,
        input_sha256=inputs, script_sha256=sha(Path(__file__)), selections=selections, rows=rows), indent=2) + '\n')


if __name__ == '__main__':
    main()
