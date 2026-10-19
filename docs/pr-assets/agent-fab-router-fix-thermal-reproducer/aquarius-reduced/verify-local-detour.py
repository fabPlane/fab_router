#!/usr/bin/python3
"""Replay local detour schedules, checked designs, native reports and partitions."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import native
import transaction
local = transaction.module('local_replay','local-detour.py')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results',type=Path)
p.add_argument('--source',type=Path,required=True)
a = p.parse_args()
sha = lambda b:hashlib.sha256(b).hexdigest()
def read(path):
    return path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes())
summary = json.loads(read(a.results/'summary.json'))
for name,expected in json.loads((a.results/'manifest.json').read_text()).items():
    assert sha((a.results/name).read_bytes())==expected
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
    with tempfile.TemporaryDirectory() as tmp:
        file = Path(tmp)/'board.kicad_pcb'; file.write_bytes(saved)
        board = native.pcbnew.LoadBoard(str(file))
    assert row['groups']==transaction.terminals.partition(board)
    return board

outcomes = []
for r in summary['rows']:
    baseline = r['baseline']
    board = checked(baseline['name'],original,baseline)
    pad = next(p for p in board.GetPads() if p.m_Uuid.AsString()==summary['pad_uuid'])
    assert any(e['type']=='starved_thermal' and any(i['uuid']==summary['pad_uuid'] for i in e['items']) for e in baseline['errors'])
    centre=tuple(pad.GetPosition()); assert list(centre)==r['centre_nm']
    nearby=local.geometry.nearby(board,pad,2); assert nearby==r['nearby']
    gap=min(z.GetThermalReliefGap() for z in board.Zones() if z.GetNetCode()==pad.GetNetCode() and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq()))
    assert gap==r['gap_nm']
    candidates, skipped=[],[]
    for rank, info in enumerate(nearby,1):
        track=next(n for n in nodes if isinstance(n,list) and native.uid(n)==info['uuid'])
        for radius_scale in (1.,2.):
            for scale in (-.2,.2,-.4,.4,-.6,.6,-.8,.8,-1.,1.):
                radius,shift=round(gap*radius_scale),round(gap*scale)
                meta=dict(rank=rank,track_uuid=info['uuid'],radius_nm=radius,shift_nm=shift)
                parts=local.detour(track,centre,radius,shift)
                if parts is None:
                    skipped.append(meta);continue
                changed=list(nodes); idx=changed.index(track);changed[idx:idx+1]=parts
                candidates.append((meta,(native.dump(changed)+'\n').encode()))
    selected=original
    for index, attempt in enumerate(r['attempts']):
        meta,candidate=candidates[index]
        assert all(attempt[k]==v for k,v in meta.items())
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
        assert len(r['attempts'])==len(candidates) and r['skipped']==skipped
    assert r['accepted']==(selected!=original)
    assert read(a.results/f'selected-{r["repeat"]}.kicad_pcb')==selected
    assert sha(selected)==r['selected_sha256']
    outcomes.append((sha(selected),[(x['accepted'],x['exception'],len(x['row']['errors']) if x['row'] else None,x['row']['opens'] if x['row'] else None) for x in r['attempts']]))
assert outcomes[0]==outcomes[1]==outcomes[2]
print(f'PASS: {count} native checks; complete local schedules, designs, rules, reports, partitions and repeat stability')
