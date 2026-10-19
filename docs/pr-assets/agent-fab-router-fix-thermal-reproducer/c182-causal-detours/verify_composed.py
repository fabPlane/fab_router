"""Replay sequential publication and native proof, including rollback and unchanged nodes."""
import argparse,hashlib,json,sys
from collections import Counter
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args();out=x.root/'composed';z=json.loads((out/'summary.json').read_text());source=(x.root/'source/board.kicad_pcb').read_bytes();sha=lambda d:hashlib.sha256(d).hexdigest();checks=0
for repeat,r in enumerate(z['repeats']):
    current=source;baseline=r['baseline']
    entries=[(baseline['name'],baseline,source,None)]+[(a['name'],a['row'],(out/(a['name']+'.proposal.kicad_pcb')).read_bytes(),a) for a in r['attempts']]
    for name,row,data,a in entries:
        saved=out/name/'board.kicad_pcb';report=json.loads(saved.with_name('drc.json').read_text())
        assert m.transaction.identity.design_signature(data)==m.transaction.identity.design_signature(saved.read_bytes())
        assert row['errors']==[e for e in report['violations'] if e['severity']=='error'] and row['opens']==len(report['unconnected_items'])
        assert row['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
        for ext in ('.kicad_pro','.kicad_dru'):assert saved.with_suffix(ext).read_bytes()==(x.root/'source'/('board'+ext)).read_bytes()
        if a:
            assert sha(current)==a['before_sha256']
            nodes=m.native.parse(current.decode());candidate=m.native.parse(data.decode());before=Counter(m.native.dump(n) for n in nodes);after=Counter(m.native.dump(n) for n in candidate)
            removed=[m.native.parse(s) for s in (before-after).elements()];added=[m.native.parse(s) for s in (after-before).elements()]
            if a['entry'] is None:
                assert {m.native.uid(n) for n in removed}=={'d3812c01-5e0b-47fa-b2de-04d261bdf01e','cf900d68-bf19-405c-828e-e774c2771825','1adf0f37-dc56-4f22-b0f7-e01166fcee29'}
                assert {m.native.uid(n) for n in removed}=={m.native.uid(n) for n in added}
                def stripped(n):return Counter(m.native.dump(v) for v in n if not isinstance(v,list) or v[0] not in ('at','start','end'))
                for n in removed:assert stripped(n)==stripped(next(v for v in added if m.native.uid(v)==m.native.uid(n)))
            else:
                assert len(removed)==1 and m.native.uid(removed[0])==a['entry']['uid']
                if a['entry'].get('delete'):assert not added
                else:
                    assert len(added)==3
                    def properties(n):return Counter(m.native.dump(v) for v in n if not isinstance(v,list) or v[0] not in ('start','end','uuid'))
                    assert all(properties(n)==properties(removed[0]) for n in added)
                    # Exact independent proposal already validated by verify.py; only other steps may precede it.
                    originals=json.loads((x.root/'summary.json').read_text())['repeats'][repeat]['attempts']
                    original=next(v for v in originals if v['label']==a['label'] and v['accepted'])
                    original_nodes=m.native.parse((x.root/'native'/(original['name']+'.proposal.kicad_pcb')).read_text())
                    assert Counter(m.native.dump(n) for n in added)<=Counter(m.native.dump(n) for n in original_nodes)
            lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups']);assert lost==a['lost_pairs']
            accepted=bool(m.transaction.errors(row)<m.transaction.errors(baseline) and row['groups'].keys()==baseline['groups'].keys() and not lost and row['opens']<=baseline['opens']);assert accepted==a['accepted']
            if accepted:current=data;baseline=row
        checks+=1
    assert current==(out/f'selected-{repeat}.kicad_pcb').read_bytes() and sha(current)==r['selected_sha256'] and baseline==r['final']
    assert not m.transaction.terminals.lost_pairs(r['baseline']['groups'],r['final']['groups'])
assert len(z['repeats'])==3 and len({r['selected_sha256'] for r in z['repeats']})==1
print(f'PASS: {checks} sequential native checks, exact source changes/rules, error-subset/terminal policy, final publication and identical bytes 3/3')
