#!/usr/bin/python3
"""Bounded static segment-detour diagnostic, not a production routing policy."""
import argparse
import copy
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid

p = Path(__file__).resolve().parent.parent / 'c167-j4-removal/measure.py'
s = importlib.util.spec_from_file_location('removal', p)
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)
native, identity = m.m.native, m.m.identity


def variants(witness):
    start = tuple(float(v) for v in native.child(witness, 'start')[1:])
    end = tuple(float(v) for v in native.child(witness, 'end')[1:])
    yield 'original-segment', [witness]
    yield 'removed', []
    bends = [('upper-right', [(start[0], end[1])]),
             ('lower-left', [(end[0], start[1])])]
    # Fixed coordinates preserve width, net, layer and endpoints. No relaxation.
    for offset in (0.5, 1.0, 1.5, 2.0):
        bends.append((f'upper-offset-{offset}', [(start[0], end[1]-offset),
                                               (end[0], end[1]-offset)]))
    for label, bends in bends:
        points = [start, *bends, end]
        result = []
        for index, (a, b) in enumerate(zip(points, points[1:])):
            segment = copy.deepcopy(witness)
            native.child(segment, 'start')[1:] = [f'{v:.6f}' for v in a]
            native.child(segment, 'end')[1:] = [f'{v:.6f}' for v in b]
            native.child(segment, 'uuid')[1] = '"' + str(uuid.uuid5(
                uuid.NAMESPACE_URL, f'j4-static-detour-{label}-{index}')) + '"'
            result.append(segment)
        yield label, result


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--input', type=Path, required=True)
    a.add_argument('--routed', type=Path, required=True)
    a.add_argument('--out', type=Path, required=True)
    a.add_argument('--repeat', type=int, default=3)
    x = a.parse_args()
    assert x.repeat > 0 and native.pcbnew.Version() == '10.0.6'
    x.out.mkdir(parents=True, exist_ok=False)
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
              for board in (x.input, x.routed)
              for p in (board, board.with_suffix('.kicad_pro'), board.with_suffix('.kicad_dru'))}
    nodes, rnodes = (native.parse(p.read_text()) for p in (x.input, x.routed))
    added = m.m.added_items(native.pcbnew.LoadBoard(str(x.input)),
                            native.pcbnew.LoadBoard(str(x.routed)))
    byid = {native.uid(n): n for n in rnodes if isinstance(n, list)
            and n[0] in ('segment', 'via', 'arc')}
    assert len(added) == 153 and m.WITNESS in added
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert x.input.with_suffix(ext).read_bytes() == x.routed.with_suffix(ext).read_bytes()
    base = nodes + [byid[i] for i in added if i != m.WITNESS]
    schedule = [('original-input', nodes)] + [(label, base + segments)
                for label, segments in variants(byid[m.WITNESS])]
    native.SRC, native.D = x.input, x.out
    rows, seen = [], {}
    for repeat in range(x.repeat):
        for label, candidate_nodes in schedule:
            candidate = (native.dump(candidate_nodes) + '\n').encode()
            row = native.check(candidate_nodes, f'{repeat}-{label}')
            d = x.out / row['name']
            saved = (d / 'board.kicad_pcb').read_bytes()
            preserved = identity.design_signature(candidate) == identity.design_signature(saved)
            assert preserved, (row['name'], 'saved design drift')
            for ext in ('.kicad_pro', '.kicad_dru'):
                assert (d / ('board' + ext)).read_bytes() == x.input.with_suffix(ext).read_bytes()
            report = json.loads((d / 'drc.json').read_text())
            canonical = (Counter(json.dumps(e, sort_keys=True) for e in row['errors']), row['opens'])
            if label in seen:
                assert seen[label] == canonical, (label, 'unstable native repeat')
            seen[label] = canonical
            if label == 'original-input':
                assert not row['errors'] and row['opens'] == 55
            elif label == 'original-segment':
                assert len(row['errors']) == 1 and row['errors'][0]['type'] == 'starved_thermal' and row['opens'] == 0
            elif label == 'removed':
                assert not row['errors'] and row['opens'] == 1
                ids = {i['uuid'] for i in report['unconnected_items'][0]['items']}
                assert '1f6610a4-c083-4688-9c02-10db286b2019' in ids
                assert ids <= {'1f6610a4-c083-4688-9c02-10db286b2019',
                               '9c9c7040-f0c6-4643-82bf-072cee572a5c',
                               '458fe5ec-74df-4dfe-9d0d-bfdcaf4f0576'}
            elif label == 'upper-right':
                assert not row['errors'] and row['opens'] == 0
            (d / 'proposal.kicad_pcb.gz').write_bytes(gzip.compress(candidate, mtime=0))
            row.update(label=label, repeat=repeat, design_preserved=True,
                       proposed_sha256=hashlib.sha256(candidate).hexdigest(),
                       saved_sha256=hashlib.sha256(saved).hexdigest())
            rows.append(row)
            (x.out / 'progress.json').write_text(json.dumps(rows, indent=2)+'\n')
    assert hashes == {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in hashes}
    summary = dict(production_fix=False, routing_benchmark=False,
                   native_version=native.pcbnew.Version(), source_sha256=hashes,
                   witness=m.WITNESS, repeats=x.repeat, rows=rows)
    (x.out / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(f'PASS: {len(rows)} native checks, no saved design drift, complete error multisets and open counts repeat')

if __name__ == '__main__':
    main()
