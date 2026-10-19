"""Replay retained complete-board native evidence without executing a native refill."""
import argparse, hashlib, json
from collections import Counter
from pathlib import Path
import measure as m
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'summary.json').read_text());source=(x.root/'source/board.kicad_pcb').read_bytes()
assert len(z['repeats'])==3
for path,digest in z['source_hashes'].items():assert m.sha((x.root/path).read_bytes())==digest
original={m.native.uid(n) for n in m.native.parse((x.root/'input/board.kicad_pcb').read_text()) if isinstance(n,list)}
def protected(data):
    nodes=m.native.parse(data.decode())
    return Counter(m.native.dump(n) for n in nodes if not(isinstance(n,list) and n[0] in ('segment','via') and m.native.uid(n) not in original))
protected_source=protected(source)
checks=errors=opens=drifts=accepted=0

def check(name,row,data):
    global checks,errors,opens,drifts
    assert protected(data)==protected_source
    saved=x.root/'native'/name/'board.kicad_pcb';report=json.loads(saved.with_name('drc.json').read_text())
    faithful=m.transaction.identity.design_signature(data)==m.transaction.identity.design_signature(saved.read_bytes())
    if row is None:
        assert not faithful;drifts+=1
    else:
        assert faithful
        assert Counter(map(lambda a:json.dumps(a,sort_keys=True),row['errors']))==Counter(json.dumps(e,sort_keys=True) for e in report['violations'] if e['severity']=='error')
        assert row['opens']==len(report['unconnected_items'])
        assert row['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
        errors+=len(row['errors']);opens+=row['opens']
    for ext in ('.kicad_pro','.kicad_dru'):assert saved.with_suffix(ext).read_bytes()==(x.root/'source'/('board'+ext)).read_bytes()
    checks+=1

def policy(before,row):
    return bool(row and m.transaction.errors(row)<m.transaction.errors(before)
        and row['groups'].keys()==before['groups'].keys()
        and not m.transaction.terminals.lost_pairs(before['groups'],row['groups']) and row['opens']<=before['opens'])
signatures=[]
for r in z['repeats']:
    baseline=r['baseline'];check(baseline['name'],baseline,source)
    assert r['pool']==[list(a) for a in m.candidates(source,original,baseline['errors'])]
    causes=[];signature=[]
    for a,(uid,kind) in zip(r['discovery'],r['pool'],strict=True):
        assert (a['uid'],a['kind'])==(uid,kind)
        data=m.remove(source,uid);assert data==(x.root/'native'/(a['name']+'.proposal.kicad_pcb')).read_bytes()
        check(a['name'],a['row'],data)
        if not a['row']:assert a['failure']=='checked board differs from proposed design'
        causal=bool(a['row'] and m.transaction.errors(a['row'])<m.transaction.errors(baseline))
        assert causal==a['causal']
        if causal:causes.append([uid,kind])
        signature.append((uid,kind,causal,a['failure'],(sorted(m.transaction.errors(a['row']).items()),a['row']['opens'],a['row']['groups']) if a['row'] else None))
    assert causes==r['causes']
    current=source;prior=baseline;cursor=0
    for uid,kind in causes:
        for variant,data in m.proposals(current,uid,kind,original):
            a=r['attempts'][cursor];cursor+=1
            assert (a['uid'],a['kind'],a['variant'])==(uid,kind,variant)
            assert a['before_sha256']==m.sha(current)
            assert data==(x.root/'native'/(a['name']+'.proposal.kicad_pcb')).read_bytes()
            check(a['name'],a['row'],data)
            if a['row'] is None:assert a['failure']=='ValueError'
            assert a['accepted']==policy(prior,a['row'])
            signature.append((uid,variant,a['accepted'],a['failure'],(sorted(m.transaction.errors(a['row']).items()),a['row']['opens'],a['row']['groups']) if a['row'] else None))
            if a['accepted']:current=data;prior=a['row'];accepted+=1;break
    assert cursor==len(r['attempts']) and prior==r['final'] and r['complete']==(not prior['errors'])
    published=current if r['complete'] else source
    assert m.sha(published)==r['selected_sha256']
    assert (x.root/f'selected-{len(signatures)}.kicad_pcb').read_bytes()==published
    signatures.append(signature)
assert all(a==signatures[0] for a in signatures[1:])
print(json.dumps(dict(checks=checks,faithful_checks=checks-drifts,identity_rejected=drifts,errors=errors,opens=opens,accepted=accepted,candidates_per_repeat=len(z['repeats'][0]['pool']),causes_per_repeat=len(z['repeats'][0]['causes']),final=[(len(r['final']['errors']),r['final']['opens'],r['complete']) for r in z['repeats']])))
print('PASS: marker discovery, causal probes, proposal reconstruction, protected source nodes, native saved identity/rules/findings/terminal partitions, sequential policy, rollback and three repeat signatures')
