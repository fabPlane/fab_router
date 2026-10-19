#!/usr/bin/python3
"""Check whether the isolated J4 thermal witness is necessary in the full route."""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

p = Path(__file__).resolve().parent.parent / 'c165-thermal-causes/isolate.py'
s = importlib.util.spec_from_file_location('isolate', p)
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)
WITNESS = '0798b683-fd93-4297-af4b-3f2365f20b8e'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--routed', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    x = parser.parse_args()
    x.out.mkdir(parents=True, exist_ok=False)
    assert m.native.pcbnew.Version() == '10.0.6'
    paths = [p for b in (x.input, x.routed) for p in
             (b, b.with_suffix('.kicad_pro'), b.with_suffix('.kicad_dru'))]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert x.input.with_suffix(ext).read_bytes() == x.routed.with_suffix(ext).read_bytes()
    nodes = m.native.parse(x.input.read_text())
    rnodes = m.native.parse(x.routed.read_text())
    added = m.added_items(m.native.pcbnew.LoadBoard(str(x.input)),
                          m.native.pcbnew.LoadBoard(str(x.routed)))
    byid = {m.native.uid(n): n for n in rnodes
            if isinstance(n, list) and n[0] in ('segment', 'via', 'arc')}
    assert len(added) == 153 and WITNESS in added
    assert not list(m.native.pcbnew.LoadBoard(str(x.input)).GetTracks())
    m.native.SRC, m.native.D = x.input, x.out
    schedule = [('original', []), ('complete', added),
                ('complete-minus-witness', [i for i in added if i != WITNESS])]
    rows = []
    repeated = {}
    for repeat in range(3):
        for label, selected in schedule:
            candidate = (m.native.dump(nodes + [byid[i] for i in selected]) + '\n').encode()
            row = m.native.check(m.native.parse(candidate.decode()), f'{repeat}-{label}')
            d = x.out / row['name']
            saved = (d / 'board.kicad_pcb').read_bytes()
            preserved = m.identity.design_signature(candidate) == m.identity.design_signature(saved)
            assert preserved, (row['name'], 'saved native design drift')
            for ext in ('.kicad_pro', '.kicad_dru'):
                assert (d / ('board' + ext)).read_bytes() == x.input.with_suffix(ext).read_bytes()
            canonical = (row['errors'], row['opens'])
            if label in repeated:
                assert repeated[label] == canonical, (label, 'unstable repeats')
            repeated[label] = canonical
            if label == 'original':
                assert not row['errors'] and row['opens'] == 55
            elif label == 'complete':
                assert len(row['errors']) == 1 and row['errors'][0]['type'] == 'starved_thermal'
                assert row['opens'] == 0
            (d / 'proposal.kicad_pcb.gz').write_bytes(gzip.compress(candidate, mtime=0))
            row.update(label=label, repeat=repeat, selected=selected, design_preserved=preserved,
                       proposed_sha256=hashlib.sha256(candidate).hexdigest(),
                       saved_sha256=hashlib.sha256(saved).hexdigest())
            rows.append(row)
            (x.out / 'progress.json').write_text(json.dumps(rows, indent=2) + '\n')
    assert hashes == {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    summary = dict(production_fix=False, routing_benchmark=False, witness=WITNESS,
                   native_version=m.native.pcbnew.Version(), source_sha256=hashes,
                   added=[dict(uuid=i, node=byid[i]) for i in added], rows=rows)
    (x.out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print('PASS: nine native checks, stable repeats, no saved design drift')

if __name__ == '__main__':
    main()
