#!/usr/bin/python3
"""Shared-endpoint discovery must not depend on a hypothetical displacement."""
import copy
import json
import native
import transaction
m = transaction.module('selection_junction', 'junction-proposals.py')
def segment(uid, start, end):
    return native.parse(f'(segment (start {start}) (end {end}) (width 0.2) (layer "F.Cu") (net 1) (uuid "{uid}"))')
results=[]
for repeat in range(1,4):
    for name, remote in [('diagonal-positive','0.000001 0.000001'),
                         ('diagonal-negative','-0.000001 -0.000001'),
                         ('ordinary','1 1')]:
        nodes=['kicad_pcb',segment('a','0 0','5 0'),segment('b','0 0',remote)]
        before=copy.deepcopy(nodes)
        try:
            selected=m.shared_junction(nodes,'a',(0,0))
            assert selected==(0,0)
            assert nodes==before
            results.append(dict(repeat=repeat,case=name,passed=True))
        except (ValueError,AssertionError) as exc:
            results.append(dict(repeat=repeat,case=name,passed=False,error=str(exc)))
print(json.dumps(results,indent=2))
assert all(row['passed'] for row in results), 'valid shared junction rejected'
