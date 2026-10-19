#!/usr/bin/python3
"""Offline bounded full-board detour search for an explicitly isolated added segment.

No editor mutation, engine integration, cause discovery, or scored routing gain.
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


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--segment', required=True)
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
    assert x.segment not in original_ids, 'Only explicitly isolated generated copper may be replaced'
    candidates = list(proposals(nodes, x.segment))
    assert len(candidates) <= 6
    rows = []
    for repeat in range(3):
        baseline = transaction.checked_native(original, f'baseline-{repeat}')
        deleted = [n for n in nodes if not (isinstance(n, list)
                   and n[0] == 'segment' and native.uid(n) == x.segment)]
        deletion = (native.dump(deleted)+'\n').encode()
        restored, accepted, control, exception = transaction.transact(original, deletion, baseline,
            lambda data: transaction.checked_native(data, f'deletion-{repeat}'))
        assert not accepted and restored == original, 'Deletion must not disconnect the full route'
        assert exception is None and control['opens'] > baseline['opens']
        attempts, selected = [], original
        for index, candidate in enumerate(candidates):
            name = f'candidate-{repeat}-{index}'
            output, accepted, row, exception = transaction.transact(original, candidate, baseline,
                lambda data: transaction.checked_native(data, name))
            (x.out / (name+'.proposal.kicad_pcb')).write_bytes(candidate)
            attempts.append(dict(name=name, accepted=accepted, row=row, exception=exception,
                                  candidate_sha256=sha(candidate)))
            assert output == (candidate if accepted else original)
            if accepted:
                selected = output
                break
        # Output publication follows validation; inputs are never overwritten.
        (x.out / f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat, baseline=baseline, deletion_control=control,
                         deletion_byte_rollback=restored == original, attempts=attempts,
                         accepted=selected != original, selected_sha256=sha(selected)))
    assert len({r['selected_sha256'] for r in rows}) == 1
    assert inputs == {path: sha(Path(path).read_bytes()) for path in inputs}
    (x.out/'summary.json').write_text(json.dumps(dict(production_fix=False,
        routing_benchmark=False, source_sha256=inputs, segment=x.segment,
        native_version=native.pcbnew.Version(), rows=rows), indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 full-board selections; source bytes preserved')

if __name__ == '__main__':
    main()
