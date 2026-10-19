#!/usr/bin/python3
"""Offline missing-corridor obstruction diagnostic; stored gap is a search scale only."""
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
spec = importlib.util.spec_from_file_location('selection', HERE / 'select-dogleg.py')
selection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selection)


def same_outcome(before, after):
    """Compare complete error multisets and exact non-error outcome fields."""
    errors = lambda row: Counter(json.dumps(e, sort_keys=True) for e in row['errors'])
    return (errors(before) == errors(after)
            and all(before[field] == after[field] for field in ('opens', 'groups', 'eligible')))


def overlap(a, b):
    result = native.pcbnew.SHAPE_POLY_SET(a)
    result.BooleanIntersection(b)
    return result.Area()


def topology(board, pad, gap):
    spec = importlib.util.spec_from_file_location('corridors', HERE / 'local-corridors.py')
    corridors = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(corridors)
    layer = native.pcbnew.B_Cu
    assert pad.IsOnLayer(layer)
    copper = native.pcbnew.SHAPE_POLY_SET()
    for zone in board.Zones():
        if zone.GetNetCode() == pad.GetNetCode() and zone.IsOnLayer(layer):
            copper.BooleanAdd(zone.GetFilledPolysList(layer))
    ranked, metrics = {}, {}
    for direction in ('+x', '-x', '+y', '-y'):
        strip = corridors.strip(pad, direction, 100000, gap)
        missing = native.pcbnew.SHAPE_POLY_SET(strip)
        missing.BooleanSubtract(copper)
        blockers = []
        for track in board.GetTracks():
            if (type(track) != native.pcbnew.PCB_TRACK or track.GetLayer() != layer
                    or track.GetNetCode() == pad.GetNetCode()):
                continue
            envelope = native.pcbnew.SHAPE_POLY_SET()
            # Diagnostic envelope, not an effective native clearance resolver.
            track.TransformShapeToPolygon(envelope, layer, gap, 1000, native.pcbnew.ERROR_OUTSIDE)
            area = overlap(missing, envelope)
            if area:
                blockers.append(dict(uuid=track.m_Uuid.AsString(), overlap_nm2=area))
                ranked[track.m_Uuid.AsString()] = max(ranked.get(track.m_Uuid.AsString(), 0), area)
        metrics[direction] = dict(missing_nm2=missing.Area(), blockers=sorted(blockers, key=lambda r: (-r['overlap_nm2'], r['uuid'])))
    # Bounded top two by missing-area overlap; independent of native candidate outcomes.
    tracks = []
    for uid, area in sorted(ranked.items(), key=lambda item: (-item[1], item[0]))[:2]:
        track = next(t for t in board.GetTracks() if t.m_Uuid.AsString() == uid)
        dx, dy = track.GetEnd().x-track.GetStart().x, track.GetEnd().y-track.GetStart().y
        length = math.hypot(dx, dy)
        assert length > 0
        tracks.append(dict(uuid=uid, overlap_nm2=area, normal=[-dy/length, dx/length]))
    return tracks, metrics


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--pad', required=True, help='Failing pad UUID from a native thermal error')
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--normal-scales', type=float, nargs='+', default=[-2, -1, 1, 2],
                   help='Finite nonzero multiples of the stored gap; diagnostic search only')
    a = p.parse_args()
    assert all(math.isfinite(v) and v != 0 for v in a.normal_scales)
    assert len(set(a.normal_scales)) == len(a.normal_scales)
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
    tracks, metrics = topology(board, pad, gap)
    for info in tracks:
        info['direction'] = info['normal']
    base = native.parse(a.source.read_text())
    candidates = [('baseline', base, None)]
    for rank, info in enumerate(tracks, 1):
        for sign in a.normal_scales:
            label = f'near-{rank}-normal-{sign:g}'
            nodes = copy.deepcopy(base)
            original = next(n for n in base if isinstance(n, list) and native.uid(n) == info['uuid'])
            track = next(n for n in nodes if isinstance(n, list) and native.uid(n) == info['uuid'])
            delta = [round(sign*gap*v) for v in info['direction']]
            for key in ('start', 'end'):
                before, after = native.child(original, key), native.child(track, key)
                after[1:] = [f'{float(before[axis+1])+delta[axis]/1e6:.6f}' for axis in (0, 1)]
                link = copy.deepcopy(original)
                native.child(link, 'start')[1:] = before[1:]
                native.child(link, 'end')[1:] = after[1:]
                native.child(link, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL, f'topology-dogleg-{a.pad}-{label}-{key}'))+'"'
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
        assert all(same_outcome(group[0], row) for row in group)
    assert inputs == {name: sha(Path(name)) for name in inputs}
    (a.out / 'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        native_version=native.pcbnew.Version(), repeats=3, pad_uuid=a.pad, stored_zone_gap_nm=gap,
        step_nm=gap, normal_scales=a.normal_scales, directions='normal', corridor_width_nm=100000, topology=metrics, pad_angle_deg=pad.GetOrientationDegrees(), nearby=tracks, input_sha256=inputs, script_sha256=sha(Path(__file__)),
        selections=winners, controls=selection.controls(), rows=rows), indent=2)+'\n')


if __name__ == '__main__':
    main()
