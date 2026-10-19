#!/usr/bin/python3
"""Reconstruct every proposal and check retained native evidence; does not run DRC."""
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
assert not z['production_fix'] and not z['routing_benchmark']
assert z['native_version'] == '10.0.6' and z['repeats'] == 3
assert z['witness'] == m.m.WITNESS
for board in (x.input, x.routed):
    for p in (board, board.with_suffix('.kicad_pro'), board.with_suffix('.kicad_dru')):
        assert hashlib.sha256(p.read_bytes()).hexdigest() in z['source_sha256'].values()
nodes, rnodes = (m.native.parse(p.read_text()) for p in (x.input, x.routed))
added = m.m.m.added_items(m.native.pcbnew.LoadBoard(str(x.input)),
                          m.native.pcbnew.LoadBoard(str(x.routed)))
byid = {m.native.uid(n): n for n in rnodes if isinstance(n, list)
        and n[0] in ('segment', 'via', 'arc')}
assert len(added) == 153 and z['witness'] in added
base = nodes + [byid[i] for i in added if i != z['witness']]
variants = dict(m.variants(byid[z['witness']]))
expected = {'original-input': nodes, **{label: base + segments
                                       for label, segments in variants.items()}}
seen, coverage, outcomes = {}, set(), {}
for row in z['rows']:
    label, repeat = row['label'], row['repeat']
    assert label in expected and repeat in range(3) and (label, repeat) not in coverage
    coverage.add((label, repeat))
    assert row['name'] == f'{repeat}-{label}' and row['design_preserved'] is True
    d = x.results / row['name']
    proposal = gzip.decompress((d / 'proposal.kicad_pcb.gz').read_bytes())
    assert proposal == (m.native.dump(expected[label])+'\n').encode()
    saved = (d / 'board.kicad_pcb').read_bytes()
    assert m.identity.design_signature(proposal) == m.identity.design_signature(saved)
    for kind, data in [('proposed', proposal), ('saved', saved)]:
        assert hashlib.sha256(data).hexdigest() == row[kind+'_sha256']
    for ext in ('.kicad_pro', '.kicad_dru'):
        assert (d / ('board'+ext)).read_bytes() == x.input.with_suffix(ext).read_bytes()
    report = json.loads((d / 'drc.json').read_text())
    errors = [e for e in report['violations'] if e['severity'] == 'error']
    assert errors == row['errors'] and len(report['unconnected_items']) == row['opens']
    canonical = (Counter(json.dumps(e, sort_keys=True) for e in errors), row['opens'])
    if label == 'removed':
        ids = {i['uuid'] for i in report['unconnected_items'][0]['items']}
        assert '1f6610a4-c083-4688-9c02-10db286b2019' in ids
        assert ids <= {'1f6610a4-c083-4688-9c02-10db286b2019',
                       '9c9c7040-f0c6-4643-82bf-072cee572a5c',
                       '458fe5ec-74df-4dfe-9d0d-bfdcaf4f0576'}
    if label in seen:
        assert seen[label] == canonical
    seen[label] = canonical
    outcomes[label] = dict(errors=len(errors), opens=row['opens'],
                           rules=dict(Counter(e['type'] for e in errors)))
assert coverage == {(label, repeat) for label in expected for repeat in range(3)}
assert outcomes['original-input'] == dict(errors=0, opens=55, rules={})
assert outcomes['original-segment'] == dict(errors=1, opens=0, rules={'starved_thermal': 1})
assert outcomes['removed'] == dict(errors=0, opens=1, rules={})
assert outcomes['upper-right'] == dict(errors=0, opens=0, rules={})
# Native may report either of these touching same-net items as the open endpoint.
board = m.native.pcbnew.LoadBoard(str(x.routed))
tracks = {t.m_Uuid.AsString(): t for t in board.GetTracks()}
track = tracks['9c9c7040-f0c6-4643-82bf-072cee572a5c']
via = tracks['458fe5ec-74df-4dfe-9d0d-bfdcaf4f0576']
assert track.GetNetname() == via.GetNetname() == 'Net-(LO(Q)1-Pad1)'
assert tuple(via.GetPosition()) in (tuple(track.GetStart()), tuple(track.GetEnd()))
assert track.IsOnLayer(m.native.pcbnew.B_Cu) and via.IsOnLayer(m.native.pcbnew.B_Cu)
# Same endpoints/net/layer/width, all 152 unaffected generated items retained.
witness = byid[z['witness']]
segments = variants['upper-right']
assert len(segments) == 2
assert m.native.child(segments[0], 'start')[1:] == ['78.764000', '112.108000']
assert m.native.child(segments[-1], 'end')[1:] == ['76.073000', '109.855000']
assert m.native.child(segments[0], 'end') == ['end', '78.764000', '109.855000']
assert m.native.child(segments[1], 'start') == ['start', '78.764000', '109.855000']
for segment in segments:
    for key in ('width', 'layer', 'net'):
        assert m.native.child(segment, key) == m.native.child(witness, key)
x.out.write_text(json.dumps(dict(checks=len(coverage), saved_design_drifts=0,
    production_fix=False, routing_benchmark=False, outcomes=outcomes), indent=2)+'\n')
print(f'PASS: {len(coverage)} native evidence checks; repeated clean connected detour; no saved design drift')
