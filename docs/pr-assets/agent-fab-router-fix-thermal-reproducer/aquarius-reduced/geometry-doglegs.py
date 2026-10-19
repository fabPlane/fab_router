#!/usr/bin/python3
"""Offline diagnostic: derive a bounded candidate set from native pad/track geometry."""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import uuid
import native

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('selection', HERE / 'select-dogleg.py')
selection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selection)


def nearby(board, pad, limit=3):
    """Rank foreign-net straight tracks by distance to pad centre on its layers."""
    x, y = pad.GetPosition()
    rows = []
    for track in board.GetTracks():
        if (type(track) != native.pcbnew.PCB_TRACK or track.GetNetCode() == pad.GetNetCode()
                or not pad.IsOnLayer(track.GetLayer())):
            continue
        a, b = track.GetStart(), track.GetEnd()
        dx, dy = b.x-a.x, b.y-a.y
        length = math.hypot(dx, dy)
        if not length:
            continue
        t = max(0, min(1, ((x-a.x)*dx+(y-a.y)*dy)/(length*length)))
        distance = math.hypot(a.x+t*dx-x, a.y+t*dy-y)
        rows.append(dict(uuid=track.m_Uuid.AsString(), distance_nm=distance,
                         normal=[-dy/length, dx/length], layer=track.GetLayerName()))
    return sorted(rows, key=lambda row: (row['distance_nm'], row['uuid']))[:limit]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--directions', choices=('normal', 'pad-axis'), default='normal')
    p.add_argument('--limit', type=int, choices=range(1, 9), default=3)
    p.add_argument('--pad', required=True, help='Failing pad UUID from a native thermal error')
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D, native.TARGET = a.source, a.out, a.pad
    assert native.pcbnew.Version() == '10.0.6'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    inputs = {str(f): sha(f) for f in (a.source, a.source.with_suffix('.kicad_pro'), a.source.with_suffix('.kicad_dru'))}
    board = native.pcbnew.LoadBoard(str(a.source))
    pad = next(pad for pad in board.GetPads() if pad.m_Uuid.AsString() == a.pad)
    zones = [zone for zone in board.Zones() if zone.GetNetCode() == pad.GetNetCode()
             and any(zone.IsOnLayer(layer) for layer in pad.GetLayerSet().Seq())]
    assert zones
    # Stored zone gap supplies a search scale only, not an effective-rule claim.
    gap = min(zone.GetThermalReliefGap() for zone in zones)
    assert gap > 0
    step = round(gap/5)
    tracks = nearby(board, pad, a.limit)
    angle = math.radians(-pad.GetOrientationDegrees())
    axes = [(math.cos(angle), math.sin(angle)), (-math.sin(angle), math.cos(angle))]
    for info in tracks:
        info['direction'] = info['normal'] if a.directions == 'normal' else max(axes, key=lambda axis: abs(sum(x*y for x, y in zip(axis, info['normal']))))
    assert len(tracks) == a.limit
    base = native.parse(a.source.read_text())
    candidates = [('baseline', base, None)]
    for rank, info in enumerate(tracks, 1):
        for sign in (-1, 1):
            label = f'near-{rank}-normal-{sign}'
            nodes = copy.deepcopy(base)
            original = next(n for n in base if isinstance(n, list) and native.uid(n) == info['uuid'])
            track = next(n for n in nodes if isinstance(n, list) and native.uid(n) == info['uuid'])
            delta = [round(sign*step*v) for v in info['direction']]
            for key in ('start', 'end'):
                before, after = native.child(original, key), native.child(track, key)
                after[1:] = [f'{float(before[axis+1])+delta[axis]/1e6:.6f}' for axis in (0, 1)]
                link = copy.deepcopy(original)
                native.child(link, 'start')[1:] = before[1:]
                native.child(link, 'end')[1:] = after[1:]
                native.child(link, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL, f'geometry-dogleg-{a.pad}-{label}-{key}'))+'"'
                nodes.append(link)
            restored = copy.deepcopy(nodes[:-2])
            restored[nodes.index(track)] = copy.deepcopy(original)
            assert restored == base
            candidates.append((label, nodes, dict(track_uuid=info['uuid'], delta_nm=delta)))
    rows, winners = [], []
    for repeat in range(1, 4):
        trials = []
        for label, nodes, geometry in candidates:
            row = native.check(nodes, f'{label}-{repeat}')
            folder = a.out / row['name']
            row.update(label=label, geometry=geometry,
                       groups=selection.terminals.partition(native.pcbnew.LoadBoard(str(folder / 'board.kicad_pcb'))))
            row['sha256'] = {f.name: sha(f) for f in folder.iterdir() if f.is_file() and f.suffix != '.kicad_prl'}
            trials.append(row)
        assert trials[0]['target'], 'Supplied pad must have a baseline thermal failure'
        for row in trials:
            row['eligible'] = selection.eligible(trials[0], row)
        accepted = [r for r in trials if r['eligible']]
        winner = min(accepted, key=lambda r: (len(r['errors']), r['opens'], r['label'])) if accepted else trials[0]
        winners.append(winner['label'])
        rows.extend(trials)
    assert len(set(winners)) == 1
    for label, _, _ in candidates:
        group = [r for r in rows if r['label'] == label]
        for field in ('errors', 'opens', 'groups', 'eligible'):
            assert all(r[field] == group[0][field] for r in group)
    assert inputs == {name: sha(Path(name)) for name in inputs}
    (a.out / 'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        native_version=native.pcbnew.Version(), repeats=3, pad_uuid=a.pad, stored_zone_gap_nm=gap,
        step_nm=step, directions=a.directions, pad_angle_deg=pad.GetOrientationDegrees(), nearby=tracks, input_sha256=inputs, script_sha256=sha(Path(__file__)),
        selections=winners, controls=selection.controls(), rows=rows), indent=2)+'\n')


if __name__ == '__main__':
    main()
