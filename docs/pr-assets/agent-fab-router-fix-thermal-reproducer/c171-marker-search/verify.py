"""Independently replay selection, identity and connectivity evidence without native execution."""
import argparse
import hashlib
import json
from pathlib import Path
import search
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'summary.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
for digest in z['source_sha256'].values():
    assert sha((x.results/'sources'/digest).read_bytes()) == digest
source=next(d for n,d in z['source_sha256'].items() if 'original-segment' in n and n.endswith('.kicad_pcb'))
original=next(d for n,d in z['source_sha256'].items() if 'original-input' in n and n.endswith('.kicad_pcb'))
nodes=search.native.parse((x.results/'sources'/source).read_text())
ids={search.native.uid(n) for n in search.native.parse((x.results/'sources'/original).read_text()) if isinstance(n,list)}
for r in z['rows']:
    ranked=search.rank_segments(nodes,ids,r['baseline']['errors'],z['max_segments'])
    assert ranked == r['ranked_segments']
    candidates=[(uid,b) for uid in ranked for b in search.proposals(nodes,uid)]
    for a,(uid,b) in zip(r['attempts'],candidates):
        assert uid==a['segment'] and sha(b)==a['candidate_sha256']
        assert b==(x.results/(a['name']+'.proposal.kicad_pcb')).read_bytes()
        row=a['row'];out,accepted,_,exception=search.transaction.transact(b'original',b,r['baseline'],lambda _:row)
        assert accepted==a['accepted'] and exception==a['exception']
    a=r['attempts'][-1];assert a['accepted'] and r['accepted']
    selected=(x.results/f"selected-{r['repeat']}.kicad_pcb").read_bytes()
    assert sha(selected)==r['selected_sha256']==a['candidate_sha256']
    assert a['row']['opens']==0 and a['row']['errors']==[]
    assert a['row']['groups']==r['baseline']['groups']
    saved=(x.results/a['name']/'board.kicad_pcb').read_bytes()
    assert search.transaction.identity.design_signature(saved)==search.transaction.identity.design_signature(selected)
assert len(z['rows'])==3
print('PASS: three marker-guided selections, proposal hashes, original-only exclusion, saved design and terminal partitions')
