"""Independently replay both native archives and compare exact candidate bytes."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys

p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args()
assets=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(assets/'c178-causal-tracks'))
import ablate as m
sha=lambda b:hashlib.sha256(b).hexdigest()
summaries=[];checks=errors=opens=accepted=0
for label in ('before','after'):
    root=x.root/label
    subprocess.run([sys.executable,'-B',str(assets/'c182-causal-detours/verify_composed.py'),'--root',str(root)],check=True,timeout=300)
    z=json.loads((root/'composed/summary.json').read_text());summaries.append(z)
    for name,digest in json.loads((root/'summary.json').read_text())['source_hashes'].items():
        assert sha((root/name).read_bytes())==digest
    original_ids={m.native.uid(n) for n in m.native.parse((root/'input/board.kicad_pcb').read_text()) if isinstance(n,list)}
    protected=Counter(m.native.dump(n) for n in m.native.parse((root/'source/board.kicad_pcb').read_text()) if isinstance(n,list) and m.native.uid(n) in original_ids)
    for r in z['repeats']:
        assert len(r['baseline']['errors'])==6 and r['baseline']['opens']==15
        assert not r['final']['errors'] and r['final']['opens']==14
        for a in r['attempts']:
            data=(root/'composed'/(a['name']+'.proposal.kicad_pcb')).read_bytes()
            protected_after=Counter(m.native.dump(n) for n in m.native.parse(data.decode()) if isinstance(n,list) and m.native.uid(n) in original_ids)
            assert protected_after==protected
            assert a['accepted'] and not a['lost_pairs']
            accepted+=1
        for row in [r['baseline']]+[a['row'] for a in r['attempts']]:
            checks+=1;errors+=len(row['errors']);opens+=row['opens']
def normalize(value):
    if isinstance(value,dict):
        return {k:(sorted(v,key=lambda e:json.dumps(e,sort_keys=True)) if k in ('errors','target') else normalize(v)) for k,v in value.items()}
    if isinstance(value,list):return [normalize(v) for v in value]
    return value
for left,right in zip(summaries[0]['repeats'],summaries[1]['repeats']):
    assert normalize(left)==normalize(right)
    for a in left['attempts']:
        name=a['name']+'.proposal.kicad_pcb'
        assert (x.root/'before/composed'/name).read_bytes()==(x.root/'after/composed'/name).read_bytes()
    assert left['selected_sha256']==right['selected_sha256']
for name in ('source','input'):
    for p in (x.root/'before'/name).iterdir():
        if p.suffix in ('.kicad_pcb','.kicad_pro','.kicad_dru'):
            assert p.read_bytes()==(x.root/'after'/name/p.name).read_bytes()
print(json.dumps(dict(checks=checks,errors=errors,opens=opens,policy_accepted=accepted,source_preserved=True,exact_before_after_equal=True)))
print('PASS: both native archives faithful; protected original nodes unchanged; exact candidates and final selections equal before/after 3/3')
