#!/usr/bin/python3
"""Replay the connected pair search against archived native evidence."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys
import discover as search
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--results',type=Path,required=True)
x=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
results=[]
for stage,role in [('native','stage2-source')]:
    root=x.results/stage
    z=json.loads((root/'summary.json').read_text())
    assert len(z['rows'])==3 and z['native_version']=='10.0.6'
    assert not z['production_fix'] and not z['routing_benchmark']
    def source(marker,ext='.kicad_pcb'):
        matches=[d for n,d in z['source_sha256'].items() if marker in n and n.endswith(ext)]
        assert len(matches)==1
        return (root/'sources'/matches[0]).read_bytes()
    for digest in z['source_sha256'].values():
        assert sha((root/'sources'/digest).read_bytes())==digest
    before=source(role);original=source('original-input')
    nodes=search.native.parse(before.decode())
    original_nodes=search.native.parse(original.decode())
    ids={search.native.uid(n) for n in original_nodes if isinstance(n,list)}
    # Every original tree node, including retained copper UUIDs, survives both stages.
    assert not (search.transaction.identity.design_signature(original)-search.transaction.identity.design_signature(before))
    for r in z['rows']:
        pairs=search.rank_pairs(nodes,ids,r['baseline']['errors'],z['max_pairs'])
        assert [list(p) for p in pairs]==r['ranked_segments']
        candidates=[(pair,c) for pair in pairs for c in search.proposals(nodes,pair)]
        assert 0<len(r['attempts'])<=len(candidates)<=256
        expected=before
        evidence=[(f"baseline-{r['repeat']}",before,r['baseline'],None)]
        for index,(a,(pair,b)) in enumerate(zip(r['attempts'],candidates)):
            assert a['segments']==list(pair) and sha(b)==a['candidate_sha256']
            assert b==(root/(a['name']+'.proposal.kicad_pcb')).read_bytes()
            evidence.append((a['name'],b,a['row'],a['exception']))
            def check(_):
                if a['exception']:raise ValueError('archived saved-design rejection')
                return a['row']
            output,accepted,_,exception=search.transaction.transact(before,b,r['baseline'],check)
            assert accepted==a['accepted'] and exception==a['exception']
            assert output==(b if accepted else before)
            if accepted:
                assert index==len(r['attempts'])-1
                expected=b
        if not r['accepted']:assert len(r['attempts'])==len(candidates)
        assert r['accepted']==(expected!=before)
        if r['accepted']: assert r['attempts'][-1]['row']['groups']==r['baseline']['groups']
        selected=(root/f"selected-{r['repeat']}.kicad_pcb").read_bytes()
        assert selected==expected and sha(selected)==r['selected_sha256']
        assert not (search.transaction.identity.design_signature(original)-search.transaction.identity.design_signature(selected))
        for name,proposal,row,exception in evidence:
            saved=(root/name/'board.kicad_pcb').read_bytes()
            preserved=search.transaction.identity.design_signature(saved)==search.transaction.identity.design_signature(proposal)
            for ext in ('.kicad_pro','.kicad_dru'):
                assert (root/name/('board'+ext)).read_bytes()==source(role,ext)
            if exception:
                assert exception=='ValueError' and not preserved
                continue
            assert preserved
            report=json.loads((root/name/'drc.json').read_text())
            assert row['errors']==[e for e in report['violations'] if e['severity']=='error']
            assert row['opens']==len(report['unconnected_items'])
            groups=search.transaction.terminals.partition(search.native.pcbnew.LoadBoard(str(root/name/'board.kicad_pcb')))
            assert groups==row['groups']
    assert len({r['selected_sha256'] for r in z['rows']})==1
    results.append((before,(root/'selected-0.kicad_pcb').read_bytes()))
assert all(not(set(pair)&ids) for r in z['rows'] for pair in r['ranked_segments'])
print('PASS: corner search; bounded attempts; native reports, saved designs, terminal partitions, original nodes, source hashes')
