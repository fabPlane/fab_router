"""Audit complete-board proposals, saved native evidence and selection policy offline."""
import argparse, hashlib, json, math, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'summary.json').read_text());source=(x.root/'source/board.kicad_pcb').read_bytes();nodes=m.native.parse(source.decode())
assert len(z['repeats'])==3
for path,digest in z['source_hashes'].items():assert hashlib.sha256((x.root/path).read_bytes()).hexdigest()==digest
checks=0
for repeat in z['repeats']:
    baseline=repeat['baseline'];entries=[(baseline['name'],baseline,source,None)]+[(a['name'],a['row'],(x.root/'native'/(a['name']+'.proposal.kicad_pcb')).read_bytes(),a) for a in repeat['attempts']]
    for name,row,data,attempt in entries:
        if attempt:
            uid=attempt['uid'];old=next(n for n in nodes if isinstance(n,list) and n[0]=='segment' and m.native.uid(n)==uid)
            proposal=m.native.parse(data.decode());before=Counter(m.native.dump(n) for n in nodes);after=Counter(m.native.dump(n) for n in proposal)
            assert before-after==Counter([m.native.dump(old)])
            new=[m.native.parse(s) for s in (after-before).elements()];assert len(new)==3
            start=m.native.child(old,'start')[1:3];end=m.native.child(old,'end')[1:3]
            def point(n,k):return tuple(map(float,m.native.child(n,k)[1:3]))
            tracks={point(n,'start'):n for n in new};assert len(tracks)==3
            at=tuple(map(float,start));chain=[]
            for _ in range(3):
                n=tracks.pop(at);chain.append(n);at=point(n,'end')
            assert not tracks and at==tuple(map(float,end))
            a0=tuple(map(float,start));b0=tuple(map(float,end));dx=b0[0]-a0[0];dy=b0[1]-a0[1];length=math.hypot(dx,dy);ux=dx/length;uy=dy/length
            offset=(.25,-.25,.5,-.5,1,-1,2,-2)[attempt['index']];lead=min(abs(offset),length/4)
            for p0,origin,tangent in [(point(chain[0],'end'),a0,lead),(point(chain[1],'end'),b0,-lead)]:
                vx=p0[0]-origin[0];vy=p0[1]-origin[1]
                assert abs(vx*ux+vy*uy-tangent)<.000001
                assert abs(-vx*uy+vy*ux-offset)<.000001
            expected=Counter(m.native.dump(v) for v in old if not isinstance(v,list) or v[0] not in ('start','end','uuid'))
            for n in chain:assert Counter(m.native.dump(v) for v in n if not isinstance(v,list) or v[0] not in ('start','end','uuid'))==expected
            # Every original item except the explicit causal generated segment is byte-identical as a tree.
            input_nodes=m.native.parse((x.root/'input/board.kicad_pcb').read_text())
            assert uid not in {m.native.uid(n) for n in input_nodes if isinstance(n,list)}
        saved=x.root/'native'/name/'board.kicad_pcb';report=json.loads(saved.with_name('drc.json').read_text())
        faithful=m.transaction.identity.design_signature(data)==m.transaction.identity.design_signature(saved.read_bytes())
        if row is None:
            assert not faithful and attempt['failure']=='checked board differs from proposed design' and not attempt['accepted']
        else:
            assert faithful and row['errors']==[e for e in report['violations'] if e['severity']=='error']
            assert row['opens']==len(report['unconnected_items'])
            assert row['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
            if attempt:
                lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups']);assert lost==attempt['lost_pairs']
                assert attempt['accepted']==bool(m.transaction.errors(row)<m.transaction.errors(baseline) and row['groups'].keys()==baseline['groups'].keys() and not lost and row['opens']<=baseline['opens'])
        for ext in ('.kicad_pro','.kicad_dru'):assert saved.with_suffix(ext).read_bytes()==(x.root/'source'/('board'+ext)).read_bytes()
        checks+=1
print(f'PASS: {checks} proposals/native reports, exact unaffected nodes, track properties, connectivity, rule sidecars and acceptance')
def signature(r):return [(a['label'],a['index'],a['accepted'],a['failure'],a['lost_pairs'],(sorted(m.transaction.errors(a['row']).items()),a['row']['opens'],a['row']['groups']) if a['row'] else None) for a in r['attempts']]
assert all(signature(r)==signature(z['repeats'][0]) for r in z['repeats'][1:])
print('PASS: three identical complete-board diagnostic repeats; not routing seeds or production repair')
