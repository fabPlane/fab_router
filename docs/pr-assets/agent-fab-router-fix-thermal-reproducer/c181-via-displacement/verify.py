"""Replay every saved report and independently reconstruct allowed coordinate edits."""
import argparse, copy, json, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'native/summary.json').read_text())
previous=x.root/'previous'
sources={'reduced':previous/'minimal/selected.kicad_pcb','full':previous/'connected/source/board.kicad_pcb'}
original=m.native.parse((previous/'connected/input/board.kicad_pcb').read_text())
protected=Counter(m.native.dump(n) for n in original)
UID='d3812c01-5e0b-47fa-b2de-04d261bdf01e'
for r in z['rows']:
    nodes=m.native.parse(sources[r['label']].read_text())
    moving={'d3812c01-5e0b-47fa-b2de-04d261bdf01e','cf900d68-bf19-405c-828e-e774c2771825','1adf0f37-dc56-4f22-b0f7-e01166fcee29'}
    protected=Counter(m.native.dump(n) for n in nodes if not isinstance(n,list) or m.native.uid(n) not in moving)
    if r['label']=='reduced':
        assert not (Counter(m.native.dump(n) for n in original)-Counter(m.native.dump(n) for n in nodes))
    via=next(n for n in nodes if isinstance(n,list) and n[0]=='via' and m.native.uid(n)==UID)
    point=m.native.child(via,'at');old=tuple(map(float,point[1:3]));dx,dy=r['offset']
    new=[format(old[0]+dx,'.8g'),format(old[1]+dy,'.8g')]
    point[1:3]=new
    for n in nodes:
        if not isinstance(n,list) or n[0]!='segment':continue
        for key in ('start','end'):
            at=m.native.child(n,key)
            if tuple(map(float,at[1:3]))==old:at[1:3]=new
    assert not (protected-Counter(m.native.dump(n) for n in nodes))
    data=(m.native.dump(nodes)+'\n').encode()
    assert data==(x.root/'native'/(r['name']+'.kicad_pcb')).read_bytes()
    saved=x.root/'native'/r['name']/'board.kicad_pcb'
    faithful=m.transaction.identity.design_signature(data)==m.transaction.identity.design_signature(saved.read_bytes())
    report=json.loads(saved.with_name('drc.json').read_text())
    if r['failure']:
        assert not faithful and r['row'] is None and not r['accepted']
    else:
        row=r['row'];assert faithful
        assert row['errors']==[e for e in report['violations'] if e['severity']=='error']
        assert row['opens']==len(report['unconnected_items'])
        assert row['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
        baseline=next(v['row'] for v in z['rows'] if v['label']==r['label'] and v['repeat']==r['repeat'] and v['offset']==[0,0])
        lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups'])
        assert lost==r['lost_pairs']
        assert r['accepted']==bool(m.transaction.errors(row)<m.transaction.errors(baseline) and row['groups'].keys()==baseline['groups'].keys() and not lost and row['opens']<=baseline['opens'])
    for ext in ('.kicad_pro','.kicad_dru'):
        assert saved.with_suffix(ext).read_bytes()==(previous/'connected/source'/('board'+ext)).read_bytes()
assert len(z['rows'])==54
print('PASS: 54 proposals independently reconstructed; design identity, reports, terminal groups and acceptance verified')
for label in ('reduced','full'):
    for offset in {tuple(r['offset']) for r in z['rows']}:
        group=[r for r in z['rows'] if r['label']==label and tuple(r['offset'])==offset]
        assert len(group)==3 and all(r['row'] for r in group)
        first=group[0]
        for r in group[1:]:
            assert m.transaction.errors(r['row'])==m.transaction.errors(first['row'])
            assert r['row']['groups']==first['row']['groups']
            assert r['row']['opens']==first['row']['opens']
            assert r['accepted']==first['accepted']
print('PASS: exact error multisets, terminal partitions, opens and acceptance repeat 3/3 for every offset')
