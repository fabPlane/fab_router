#!/usr/bin/python3
"""Isolate thermal errors by adding only measured generated copper to an intact input.

Static native diagnosis, not routing, repair, or a scored benchmark. All subsets
are constructed from the original input; no original design node is deleted.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from itertools import combinations
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'aquarius-reduced'))
import native

spec = importlib.util.spec_from_file_location('identity', HERE.parent / 'aquarius-reduced/design-identity.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)


def copper_key(item):
    """Geometry/net multiset, independent of session-import UUID replacement."""
    xy = lambda point: (point.x, point.y)
    if isinstance(item, native.pcbnew.PCB_VIA):
        shape = ('via', xy(item.GetPosition()), int(item.GetViaType()),
                 int(item.TopLayer()), int(item.BottomLayer()), item.GetDrillValue())
        width = item.GetWidth(item.TopLayer())
    else:
        shape = ('arc' if isinstance(item, native.pcbnew.PCB_ARC) else 'segment',
                 tuple(sorted((xy(item.GetStart()), xy(item.GetEnd())))), int(item.GetLayer()))
        if isinstance(item, native.pcbnew.PCB_ARC):
            shape += (xy(item.GetMid()),)
        width = item.GetWidth()
    return (shape, width, item.GetNetname())


def added_items(original, routed):
    remaining = Counter(copper_key(item) for item in original.GetTracks())
    added = []
    for item in sorted(routed.GetTracks(), key=lambda item: item.m_Uuid.AsString()):
        key = copper_key(item)
        if remaining[key]:
            remaining[key] -= 1
        else:
            added.append(item.m_Uuid.AsString())
    if +remaining:
        raise ValueError('routed board lost original copper geometry or multiplicity')
    return added


def error_key(error):
    return (error['type'], tuple(sorted(item['uuid'] for item in error['items'])))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--routed', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--schedule', choices=('single-and-removal', 'pairs'), default='single-and-removal')
    parser.add_argument('--repeats', type=int, default=3)
    args = parser.parse_args()
    assert args.repeats > 0
    assert native.pcbnew.Version() == '10.0.6'
    args.out.mkdir(parents=True, exist_ok=False)
    original = args.input.read_bytes()
    routed = args.routed.read_bytes()
    inputs = {str(path): hashlib.sha256(path.read_bytes()).hexdigest()
              for board in (args.input, args.routed)
              for path in (board, board.with_suffix('.kicad_pro'), board.with_suffix('.kicad_dru'))}
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert args.input.with_suffix(ext).read_bytes() == args.routed.with_suffix(ext).read_bytes()
    added = added_items(native.pcbnew.LoadBoard(str(args.input)), native.pcbnew.LoadBoard(str(args.routed)))
    nodes = native.parse(original.decode())
    routed_nodes = native.parse(routed.decode())
    by_id = {native.uid(node): node for node in routed_nodes
             if isinstance(node, list) and node[0] in ('segment', 'via', 'arc')}
    assert len(added) == 9, 'this bounded diagnostic expects the nine measured additions'
    assert len(set(added)) == len(added)
    for item in added:
        assert item not in {native.uid(node) for node in nodes if isinstance(node, list)}
    native.SRC, native.D = args.input, args.out
    schedules = [('original', []) , ('all-added', added)]
    if args.schedule == 'pairs':
        schedules += [(f'pair-{i}-{j}', [added[i], added[j]])
                      for i, j in combinations(range(len(added)), 2)]
    else:
        schedules += [(f'only-{i}', [item]) for i, item in enumerate(added)]
        schedules += [(f'except-{i}', [other for other in added if other != item])
                      for i, item in enumerate(added)]
    rows = []
    expected = None
    repeated = {}
    for repeat in range(1, args.repeats + 1):
        for label, selected in schedules:
            name = f'{repeat}-{label}'
            candidate = (native.dump(nodes + [by_id[item] for item in selected]) + '\n').encode()
            # Exact parser-level construction above retains every original node.
            row = native.check(native.parse(candidate.decode()), name)
            board = args.out/name/'board.kicad_pcb'
            wanted = identity.design_signature(candidate)
            saved = identity.design_signature(board.read_bytes())
            preserved = saved == wanted
            drift = dict(removed=repr(wanted - saved), added=repr(saved - wanted))
            for ext in ('.kicad_pro', '.kicad_dru'):
                assert board.with_suffix(ext).read_bytes() == args.input.with_suffix(ext).read_bytes()
            keys = sorted(error_key(error) for error in row['errors'])
            if label == 'original':
                assert keys == [], keys
            elif label == 'all-added':
                assert len(keys) == 2 and all(key[0] == 'starved_thermal' for key in keys)
                if expected is None:
                    expected = keys
                assert keys == expected
            elif preserved:
                assert not (Counter(keys) - Counter(expected)), (name, keys)
            if label in ('original', 'all-added'):
                assert preserved, name
            outcome = (keys, row['opens'], preserved, drift)
            if label in repeated:
                assert repeated[label] == outcome, (name, 'unstable repeat')
            repeated[label] = outcome
            (args.out/name/'proposal.kicad_pcb.gz').write_bytes(gzip.compress(candidate, mtime=0))
            row.update(label=label, repeat=repeat, selected=selected,
                       design_preserved=preserved, saved_design_drift=drift,
                       proposed_sha256=hashlib.sha256(candidate).hexdigest(),
                       saved_sha256=hashlib.sha256(board.read_bytes()).hexdigest())
            rows.append(row)
    assert inputs == {path: hashlib.sha256(Path(path).read_bytes()).hexdigest() for path in inputs}
    summary = dict(native_version=native.pcbnew.Version(), production_fix=False,
                   routing_benchmark=False, schedule=args.schedule, source_sha256=inputs,
                   added=[dict(uuid=item, node=by_id[item]) for item in added], rows=rows)
    (args.out/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(f'PASS: {len(rows)} native checks; original proposal nodes and sidecars retained; saved drift recorded; repeats agree')


if __name__ == '__main__':
    main()
