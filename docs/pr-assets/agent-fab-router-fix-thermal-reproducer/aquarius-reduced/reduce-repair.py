#!/usr/bin/python3
"""Reduce a static R20 repair witness while preserving every cropped pad terminal."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid
import native

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terminals', HERE / 'terminal-partitions.py')
terminals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terminals)
TARGET = 'd145de36-3889-4a3d-8c61-71242d4e107c'
TRACK = 'ba81d7fd-c368-4776-b597-cea64fcdd37f'
DELTA = (169073, -253609)


def repair(nodes):
    result = copy.deepcopy(nodes)
    track = next(n for n in result if isinstance(n, list) and native.uid(n) == TRACK)
    original = copy.deepcopy(track)
    for key in ('start', 'end'):
        before, after = native.child(original, key), native.child(track, key)
        after[1:] = [f'{float(before[i+1])+DELTA[i]/1e6:.6f}' for i in (0, 1)]
        link = copy.deepcopy(original)
        native.child(link, 'start')[1:] = before[1:]
        native.child(link, 'end')[1:] = after[1:]
        native.child(link, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL, f'r20-reduced-{key}'))+'"'
        result.append(link)
    assert len(result) == len(nodes) + 2
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D, native.TARGET = a.source, a.out, TARGET
    assert native.pcbnew.Version() == '10.0.6'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    inputs = {str(f): sha(f) for f in (a.source, a.source.with_suffix('.kicad_pro'), a.source.with_suffix('.kicad_dru'))}
    board = native.pcbnew.LoadBoard(str(a.source))
    pad = next(p for p in board.GetPads() if p.m_Uuid.AsString() == TARGET)
    pos, radius, keep = pad.GetPosition(), 2000000, set()
    for item in list(board.GetTracks()) + list(board.GetFootprints()):
        box = item.GetBoundingBox()
        x, y = box.GetPosition().x, box.GetPosition().y
        if (x <= pos.x+radius and x+box.GetWidth() >= pos.x-radius
                and y <= pos.y+radius and y+box.GetHeight() >= pos.y-radius):
            keep.add(item.m_Uuid.AsString())
    nodes = [n for n in native.parse(a.source.read_text()) if not (
        isinstance(n, list) and n[0] in ('segment', 'via', 'arc', 'footprint') and native.uid(n) not in keep)]
    for n in nodes:
        if isinstance(n, list) and n[0] == 'zone':
            n[:] = [v for v in n if not (isinstance(v, list) and v[0] == 'filled_polygon')]
    rows = []

    def pair(nodes, name, reference=None):
        pair_rows = []
        for label, candidate in [('before', nodes), ('after', repair(nodes))]:
            row = native.check(candidate, f'{name}-{label}')
            folder = a.out / row['name']
            row['groups'] = terminals.partition(native.pcbnew.LoadBoard(str(folder / 'board.kicad_pcb')))
            row['sha256'] = {f.name: sha(f) for f in folder.iterdir() if f.is_file() and f.suffix != '.kicad_prl'}
            pair_rows.append(row)
        before, after = pair_rows
        accepted = (len(before['target']) == len(before['errors']) == 1
                    and not after['errors'] and not after['target']
                    and before['opens'] == after['opens']
                    and before['groups'] == after['groups']
                    and (reference is None or before['groups'] == reference))
        rows.append(dict(name=name, accepted=accepted, rows=pair_rows))
        return accepted, before['groups']

    accepted, reference = pair(nodes, 'crop')
    assert accepted, 'Crop must reproduce the repair without losing a terminal connection'
    removed, counter = [], 0
    while True:
        changed = False
        for node in list(nodes):
            if not (isinstance(node, list) and node[0] in ('segment', 'via', 'arc', 'zone')
                    and native.uid(node) != TRACK):
                continue
            counter += 1
            trial = [n for n in nodes if n is not node]
            accepted, _ = pair(trial, f'delete-{counter:03d}', reference)
            rows[-1]['removed_uuid'] = native.uid(node)
            if accepted:
                nodes = trial
                removed.append(native.uid(node))
                changed = True
        if not changed:
            break
    for repeat in range(1, 4):
        accepted, _ = pair(nodes, f'final-{repeat}', reference)
        assert accepted
    (a.out / 'minimal.kicad_pcb').write_text(native.dump(nodes)+'\n')
    assert inputs == {name: sha(Path(name)) for name in inputs}
    (a.out / 'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        native_version=native.pcbnew.Version(), input_sha256=inputs, script_sha256=sha(Path(__file__)),
        pad_uuid=TARGET, track_uuid=TRACK, delta_nm=DELTA, crop_radius_nm=radius,
        terminal_inventory_scope='cropped footprints only; not full original board',
        reference_groups=reference, removed_uuids=removed, rows=rows), indent=2)+'\n')


if __name__ == '__main__':
    main()
