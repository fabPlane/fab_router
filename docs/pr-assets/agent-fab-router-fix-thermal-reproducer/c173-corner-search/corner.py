#!/usr/bin/python3
"""Offline bounded corner search over an explicitly isolated generated track pair.

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


def paths(start, joint, end):
    for distance in (0.25, 0.5, 1., 2.):
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            point = (joint[0]+distance*dx, joint[1]+distance*dy)
            if point != start and point != end:
                yield [start, point, end]


def proposals(nodes, segment_ids):
    tracks = [next(n for n in nodes if isinstance(n,list) and n[0]=='segment'
                   and native.uid(n)==uid) for uid in segment_ids]
    assert len(tracks) == 2
    assert all(native.child(tracks[0], k) == native.child(tracks[1], k)
               for k in ('width','layer','net'))
    endpoints = [[tuple(map(float,native.child(t,k)[1:])) for k in ('start','end')]
                 for t in tracks]
    shared = set(endpoints[0]) & set(endpoints[1])
    assert len(shared) == 1
    joint = shared.pop()
    start, end = [next(p for p in pair if p != joint) for pair in endpoints]
    for index, points in enumerate(paths(start,joint,end)):
        candidate = copy.deepcopy(nodes)
        candidate = [n for n in candidate if not (isinstance(n,list)
                     and n[0]=='segment' and native.uid(n) in segment_ids)]
        for j,(a,b) in enumerate(zip(points,points[1:])):
            track = copy.deepcopy(tracks[j])
            for key, point in [('start',a),('end',b)]:
                native.child(track,key)[1:] = [f'{v:.6f}' for v in point]
            native.child(track,'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'corner-{segment_ids}-{index}-{j}'))+'"'
            candidate.append(track)
        yield (native.dump(candidate)+'\n').encode()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--segments', nargs=2, required=True)
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
    assert not (set(x.segments) & original_ids)
    rows = []
    for repeat in range(3):
        baseline = transaction.checked_native(original, f'baseline-{repeat}')
        ranked = x.segments
        candidates = list(proposals(nodes, x.segments))
        assert len(candidates) <= 16
        attempts, selected = [], original
        for index, candidate in enumerate(candidates):
            name = f'candidate-{repeat}-{index}'
            output, accepted, row, exception = transaction.transact(original, candidate, baseline,
                lambda data: transaction.checked_native(data, name))
            (x.out / (name+'.proposal.kicad_pcb')).write_bytes(candidate)
            attempts.append(dict(name=name, segments=x.segments, accepted=accepted, row=row, exception=exception,
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
        routing_benchmark=False, source_sha256=inputs, segments=x.segments,
        native_version=native.pcbnew.Version(), rows=rows), indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 full-board selections; source bytes preserved')

if __name__ == '__main__':
    main()
