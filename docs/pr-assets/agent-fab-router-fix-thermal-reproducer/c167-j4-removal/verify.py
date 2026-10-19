#!/usr/bin/python3
"""Replay removal evidence against original inputs; does not authenticate reports."""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

p = Path(__file__).resolve().parent / 'measure.py'
s = importlib.util.spec_from_file_location('measure', p)
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)
a = argparse.ArgumentParser(description=__doc__)
a.add_argument('--input', type=Path, required=True)
a.add_argument('--routed', type=Path, required=True)
a.add_argument('--results', type=Path, required=True)
a.add_argument('--out', type=Path, required=True)
x = a.parse_args()
z = json.loads((x.results / 'summary.json').read_text())
assert z['production_fix'] is False and z['routing_benchmark'] is False
assert z['native_version'] == '10.0.6' and z['witness'] == m.WITNESS
assert len(z['rows']) == 9
nodes = m.m.native.parse(x.input.read_text())
rnodes = m.m.native.parse(x.routed.read_text())
added = m.m.added_items(m.m.native.pcbnew.LoadBoard(str(x.input)),
                            m.m.native.pcbnew.LoadBoard(str(x.routed)))
byid = {m.m.native.uid(n): n for n in rnodes
        if isinstance(n, list) and n[0] in ('segment', 'via', 'arc')}
assert z['added'] == [dict(uuid=i, node=byid[i]) for i in added]
assert len(added) == 153 and m.WITNESS in added
for b in (x.input, x.routed):
    for p in (b, b.with_suffix('.kicad_pro'), b.with_suffix('.kicad_dru')):
        assert hashlib.sha256(p.read_bytes()).hexdigest() in z['source_sha256'].values()
expected = {'original': [], 'complete': added,
            'complete-minus-witness': [i for i in added if i != m.WITNESS]}
seen = {}
coverage = set()
for row in z['rows']:
    label, repeat = row['label'], row['repeat']
    assert label in expected and repeat in range(3)
    assert (label, repeat) not in coverage
    coverage.add((label, repeat))
    assert row['name'] == f'{repeat}-{label}' and row['selected'] == expected[label]
    d = x.results / row['name']
    proposal = gzip.decompress((d / 'proposal.kicad_pcb.gz').read_bytes())
    assert proposal == (m.m.native.dump(nodes + [byid[i] for i in expected[label]]) + '\n').encode()
    saved = (d / 'board.kicad_pcb').read_bytes()
    for key, data in [('proposed', proposal), ('saved', saved)]:
        assert hashlib.sha256(data).hexdigest() == row[key + '_sha256']
    assert row['design_preserved'] is True
    assert m.m.identity.design_signature(proposal) == m.m.identity.design_signature(saved)
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert (d / ('board' + ext)).read_bytes() == x.input.with_suffix(ext).read_bytes()
    report = json.loads((d / 'drc.json').read_text())
    errors = [e for e in report['violations'] if e['severity'] == 'error']
    assert errors == row['errors'] and len(report['unconnected_items']) == row['opens']
    # Compare complete findings and open records, not just aggregate counts.
    canonical = tuple(Counter(json.dumps(e, sort_keys=True) for e in records)
                      for records in (errors, report['unconnected_items']))
    if label in seen:
        assert seen[label] == canonical
    seen[label] = canonical
    if label == 'original':
        assert not errors and row['opens'] == 55
    elif label == 'complete':
        assert len(errors) == 1 and errors[0]['type'] == 'starved_thermal' and row['opens'] == 0
    else:
        assert not errors and row['opens'] == 1
assert coverage == {(label, repeat) for label in expected for repeat in range(3)}
out = dict(checks=9, saved_design_drifts=0, production_fix=False, routing_benchmark=False,
           outcomes={label: dict(errors=sum(v[0].values()), opens=sum(v[1].values()))
                     for label, v in seen.items()})
x.out.write_text(json.dumps(out, indent=2) + '\n')
print('PASS: nine checks; full findings/opens repeat; zero design drift; deletion is not a complete repair')
