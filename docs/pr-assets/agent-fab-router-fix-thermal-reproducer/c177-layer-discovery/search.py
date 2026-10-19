#!/usr/bin/python3
"""Offline bounded native-marker-guided search over generated segments.

No editor mutation, engine integration, or scored routing gain.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'aquarius-reduced'))
import native
import transaction


def paths(start, end):
    dx, dy = end[0]-start[0], end[1]-start[1]
    if not dx or not dy:
        return
    sx, sy = (1 if dx > 0 else -1), (1 if dy > 0 else -1)
    for fraction in (0.125, 0.25, 0.5):
        radius = min(abs(dx), abs(dy)) * fraction
        yield [start, (start[0], end[1]-sy*radius),
               (start[0]+sx*radius, end[1]), end]
        yield [start, (end[0]-sx*radius, start[1]),
               (end[0], start[1]+sy*radius), end]


def proposals(nodes, segment_id):
    witness = next(n for n in nodes if isinstance(n, list)
                   and n[0] == 'segment' and native.uid(n) == segment_id)
    start, end = (tuple(float(v) for v in native.child(witness, key)[1:])
                  for key in ('start', 'end'))
    for index, points in enumerate(paths(start, end)):
        candidate = copy.deepcopy(nodes)
        candidate.remove(next(n for n in candidate if isinstance(n, list)
                              and n[0] == 'segment' and native.uid(n) == segment_id))
        for j, (a, b) in enumerate(zip(points, points[1:])):
            track = copy.deepcopy(witness)
            for key, point in [('start', a), ('end', b)]:
                native.child(track, key)[1:] = [f'{v:.6f}' for v in point]
            native.child(track, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'full-board-detour-{segment_id}-{index}-{j}'))+'"'
            candidate.append(track)
        yield (native.dump(candidate)+'\n').encode()


def rank_segments(nodes, original_ids, errors, limit):
    """Rank generated tracks by distance to actual thermal pad markers, never zone anchors."""
    pads = {native.uid(c) for n in nodes if isinstance(n, list) and n[0] == 'footprint'
            for c in n if isinstance(c, list) and c[0] == 'pad'}
    zones = {native.uid(n): native.child(n, 'layer')[1].strip('"')
             for n in nodes if isinstance(n, list) and n[0] == 'zone'
             and native.child(n, 'layer')}
    points = {}
    for error in errors:
        if error['type'] != 'starved_thermal':
            continue
        layers = {zones[i['uuid']] for i in error['items'] if i['uuid'] in zones}
        for layer in layers:
            points.setdefault(layer, []).extend((i['pos']['x'], i['pos']['y'])
                for i in error['items'] if i['uuid'] in pads)
    if not any(points.values()):
        return []
    def distance(n):
        a, b = [tuple(map(float, native.child(n, k)[1:])) for k in ('start', 'end')]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length2 = dx*dx+dy*dy
        def squared(p):
            t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)) if length2 else 0
            return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
        return min(map(squared, points[native.child(n, 'layer')[1].strip('"')])), native.uid(n)
    tracks = [n for n in nodes if isinstance(n, list) and n[0] == 'segment'
              and native.uid(n) and native.uid(n) not in original_ids
              and points.get(native.child(n, 'layer')[1].strip('"'))]
    return [native.uid(n) for n in sorted(tracks, key=distance)[:limit]]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--max-segments', type=int, default=8)
    p.add_argument('--out', type=Path, required=True)
    x = p.parse_args()
    x.out.mkdir(parents=True, exist_ok=False)
    assert native.pcbnew.Version() == '10.0.6'
    native.SRC, native.D = x.source, x.out
    sha = lambda data: hashlib.sha256(data).hexdigest()
    inputs = {str(b.with_suffix(ext)): sha(b.with_suffix(ext).read_bytes())
              for b in (x.input, x.source)
              for ext in ('.kicad_pcb', '.kicad_pro', '.kicad_dru')}
    (x.out/'sources').mkdir()
    for path, digest in inputs.items():
        (x.out/'sources'/digest).write_bytes(Path(path).read_bytes())
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert x.input.with_suffix(ext).read_bytes() == x.source.with_suffix(ext).read_bytes()
    original = x.source.read_bytes()
    nodes = native.parse(original.decode())
    original_ids = {native.uid(n) for n in native.parse(x.input.read_text()) if isinstance(n, list)}
    assert 1 <= x.max_segments <= 8
    rows = []
    for repeat in range(3):
        baseline = transaction.checked_native(original, f'baseline-{repeat}')
        ranked = rank_segments(nodes, original_ids, baseline['errors'], x.max_segments)
        candidates = [(uid, candidate) for uid in ranked for candidate in proposals(nodes, uid)]
        assert len(candidates) <= 48
        attempts, selected = [], original
        for index, (segment, candidate) in enumerate(candidates):
            name = f'candidate-{repeat}-{index}'
            output, accepted, row, exception = transaction.transact(original, candidate, baseline,
                lambda data: transaction.checked_native(data, name))
            (x.out / (name+'.proposal.kicad_pcb')).write_bytes(candidate)
            attempts.append(dict(name=name, segment=segment, accepted=accepted, row=row, exception=exception,
                                  candidate_sha256=sha(candidate)))
            assert output == (candidate if accepted else original)
            if accepted:
                selected = output
                break
        # Output publication follows validation; inputs are never overwritten.
        (x.out / f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat, baseline=baseline, ranked_segments=ranked, attempts=attempts,
                         accepted=selected != original, selected_sha256=sha(selected)))
    assert len({r['selected_sha256'] for r in rows}) == 1
    assert inputs == {path: sha(Path(path).read_bytes()) for path in inputs}
    (x.out/'summary.json').write_text(json.dumps(dict(production_fix=False,
        routing_benchmark=False, source_sha256=inputs, max_segments=x.max_segments,
        native_version=native.pcbnew.Version(), rows=rows), indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 full-board selections; source bytes preserved')

if __name__ == '__main__':
    main()
