#!/usr/bin/python3
"""Bounded whole-board causal track deletion diagnostic; never a routing repair."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'c177-layer-discovery'))
import search
native, transaction = search.native, search.transaction
sha = lambda data: hashlib.sha256(data).hexdigest()

def candidates(data, input_data, errors):
    nodes = native.parse(data.decode())
    ids = {native.uid(n) for n in native.parse(input_data.decode()) if isinstance(n, list)}
    pads = {native.uid(p): (native.child(f, 'property')[2].strip('"'), p[1].strip('"'))
            for f in nodes if isinstance(f, list) and f[0] == 'footprint'
            for p in f if isinstance(p, list) and p[0] == 'pad'}
    markers, selected = [], set()
    for error in errors:
        if error['type'] != 'starved_thermal':
            raise ValueError('only thermal source errors are supported')
        pad = next(i['uuid'] for i in error['items'] if i['uuid'] in pads)
        ranked = search.rank_segments(nodes, ids, [error], 8)
        markers.append(dict(pad=pad, label='.'.join(pads[pad]), tracks=ranked))
        selected.update(ranked)
    # Union avoids running the same deletion twice when it is near two markers.
    for uid in sorted(selected):
        matches = [n for n in nodes if isinstance(n, list) and n[0] == 'segment' and native.uid(n) == uid]
        assert len(matches) == 1 and uid not in ids
        yield uid, (native.dump([n for n in nodes if n is not matches[0]])+'\n').encode(), markers

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    x = p.parse_args()
    assert native.pcbnew.Version() == '10.0.6'
    x.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D = x.source, x.out
    data, input_data = x.source.read_bytes(), x.input.read_bytes()
    inputs = {str(b.with_suffix(ext)): sha(b.with_suffix(ext).read_bytes())
              for b in (x.source, x.input) for ext in ('.kicad_pcb', '.kicad_pro', '.kicad_dru')}
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert x.source.with_suffix(ext).read_bytes() == x.input.with_suffix(ext).read_bytes()
    (x.out/'sources').mkdir()
    for path, digest in inputs.items():
        (x.out/'sources'/digest).write_bytes(Path(path).read_bytes())
    rows = []
    for repeat in range(3):
        baseline = transaction.checked_native(data, f'baseline-{repeat}')
        attempts = []
        for index, (uid, proposal, markers) in enumerate(candidates(data, input_data, baseline['errors'])):
            name = f'delete-{repeat}-{index}'
            row = transaction.checked_native(proposal, name)
            removed = transaction.errors(baseline)-transaction.errors(row)
            added = transaction.errors(row)-transaction.errors(baseline)
            lost = transaction.terminals.lost_pairs(baseline['groups'], row['groups'])
            assert baseline['groups'].keys() == row['groups'].keys()
            attempts.append(dict(name=name, track=uid, proposal_sha256=sha(proposal), row=row,
                removed_errors=list(removed.elements()), added_errors=list(added.elements()), lost_pairs=lost))
        rows.append(dict(repeat=repeat, baseline=baseline, markers=markers, attempts=attempts))
    # Findings, including exact error details and terminal groups, must repeat.
    signatures = [json.dumps([(a['track'], a['row']['errors'], a['row']['opens'], a['row']['groups'],
                              a['removed_errors'], a['added_errors'], a['lost_pairs'])
                             for a in r['attempts']], sort_keys=True) for r in rows]
    assert len(set(signatures)) == 1
    assert inputs == {path: sha(Path(path).read_bytes()) for path in inputs}
    z = dict(production_fix=False, routing_benchmark=False, native_version=native.pcbnew.Version(),
             source_sha256=inputs, rows=rows)
    (x.out/'summary.json').write_text(json.dumps(z, indent=2)+'\n')
    print(f'PASS: {len(rows[0]["attempts"])} single-track deletions x 3; source bytes preserved')

if __name__ == '__main__':
    main()
