#!/usr/bin/python3
"""Replay additive thermal-link schedules, checked designs, native reports and partitions."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import native
import transaction
local = transaction.module('link_replay','thermal-links.py')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results',type=Path)
p.add_argument('--source',type=Path,required=True)
a = p.parse_args()
sha = lambda b:hashlib.sha256(b).hexdigest()
def read(path):
    return path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes())
summary = json.loads(read(a.results/'summary.json'))
local.TARGET=summary.get('target',local.TARGET)
for name,expected in json.loads((a.results/'manifest.json').read_text()).items():
    file=(a.results/name).resolve()
    assert file.is_relative_to(a.results.resolve())
    assert sha(file.read_bytes())==expected
for name,expected in summary['input_sha256'].items():
    assert sha(a.source.with_suffix(Path(name).suffix).read_bytes())==expected
assert sorted(r['repeat'] for r in summary['rows'])==[1,2,3]
original = a.source.read_bytes()
nodes = native.parse(original.decode())
count = 0

def checked(name, proposed, row, exception=None):
    global count
    folder = a.results/name
    saved = read(folder/'board.kicad_pcb')
    drift = transaction.identity.design_signature(saved)!=transaction.identity.design_signature(proposed)
    drift |= any((folder/('board'+ext)).read_bytes()!=a.source.with_suffix(ext).read_bytes() for ext in ('.kicad_pro','.kicad_dru'))
    report = json.loads(read(folder/'drc.json'))
    count += 1
    if exception is not None:
        assert exception=='ValueError' and drift and row is None
        return None
    assert not drift
    assert row['errors']==[v for v in report['violations'] if v['severity']=='error']
    assert row['opens']==len(report['unconnected_items'])
    assert row['target']==[v for v in report['violations'] if v['type']=='starved_thermal' and any(i['uuid']==local.TARGET for i in v['items'])]
    with tempfile.TemporaryDirectory() as tmp:
        file = Path(tmp)/'board.kicad_pcb'; file.write_bytes(saved)
        board = native.pcbnew.LoadBoard(str(file))
    assert row['groups']==transaction.terminals.partition(board)
    return board

outcomes = []
for r in summary['rows']:
    baseline = r['baseline']
    board = checked(baseline['name'],original,baseline)
    pad = next(p for p in board.GetPads() if p.m_Uuid.AsString()==local.TARGET)
    assert any(e['type']=='starved_thermal' and any(i['uuid']==local.TARGET for i in e['items']) for e in baseline['errors'])
    centre=tuple(pad.GetPosition()); assert list(centre)==summary['centre_nm']
    angle=pad.GetOrientationDegrees(); assert angle==summary['angle']
    gap=min(z.GetThermalReliefGap() for z in board.Zones() if z.GetNetCode()==pad.GetNetCode() and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq()))
    assert gap==summary['gap_nm']
    net='"'+pad.GetNetname()+'"'; layer=local.plane_layer(board,pad)
    assert net==summary['net'] and layer==summary['layer']
    assert layer.strip(chr(34)) in {board.GetLayerName(l) for l in pad.GetLayerSet().Seq()}
    candidates=list(local.proposals(nodes,centre,angle,net,layer,gap,summary.get("width_scales",[0.5,1.])))
    assert len(candidates)==8*len(summary.get("width_scales",[0.5,1.]))
    identities=set()
    for meta,candidate in candidates:
        changed=native.parse(candidate.decode())
        assert changed[:-1]==nodes
        track=changed[-1];assert track[0]=='segment'
        assert native.child(track,'net')==['net',net]
        assert native.child(track,'layer')==['layer',layer]
        assert round(float(native.child(track,'width')[1])*1e6)==meta['width_nm']
        point=lambda key:tuple(round(float(v)*1e6) for v in native.child(track,key)[1:])
        assert point('start')==centre and point('end')==meta['end_nm']
        assert abs(sum((a-b)**2 for a,b in zip(centre,point('end')))**0.5-3*gap)<=1
        assert native.uid(track) not in identities
        identities.add(native.uid(track))
    selected=original
    for index, attempt in enumerate(r['attempts']):
        meta,candidate=candidates[index]
        assert all(attempt[k]==json.loads(json.dumps(v)) for k,v in meta.items())
        assert attempt['name']==f'candidate-{r["repeat"]}-{index}'
        assert sha(candidate)==attempt['candidate_sha256']
        checked(attempt['name'],candidate,attempt['row'],attempt['exception'])
        expected=False
        if attempt['exception'] is None:
            row=attempt['row']
            err=lambda x:Counter(json.dumps(e,sort_keys=True) for e in x['errors'])
            expected=(err(row)<err(baseline) and row['groups'].keys()==baseline['groups'].keys()
                      and not transaction.terminals.lost_pairs(baseline['groups'],row['groups']) and row['opens']<=baseline['opens'])
        assert expected==attempt['accepted']
        if expected:
            selected=candidate
            assert index==len(r['attempts'])-1
    if selected==original:
        assert len(r['attempts'])==len(candidates)
    assert r['accepted']==(selected!=original)
    assert read(a.results/f'selected-{r["repeat"]}.kicad_pcb')==selected
    assert sha(selected)==r['selected_sha256']
    outcomes.append((sha(selected),[(x['accepted'],x['exception'],sorted(json.dumps(e,sort_keys=True) for e in x['row']['errors']) if x['row'] else None,x['row']['opens'] if x['row'] else None,x['row']['groups'] if x['row'] else None) for x in r['attempts']]))
assert outcomes[0]==outcomes[1]==outcomes[2]
print(f'PASS: {count} native checks; complete thermal-link schedules, designs, rules, reports, partitions and repeat stability')
