#!/usr/bin/python3
"""Reconstruct the known rejected candidate and identify saved-design drift.

Saved evidence only; no new native checks. Checks hashes before comparing nets.
"""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'aquarius-reduced'))
import native
import transaction
helper=transaction.module('inspect_auto','auto-links.py')
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('source',type=Path);p.add_argument('results',type=Path);p.add_argument('output',type=Path)
a=p.parse_args()
r=json.loads((a.results/'summary.json').read_text())['rows'][0]
original=native.parse(a.source.read_text())
selected=native.parse((a.results/'repeat-1/selected.kicad_pcb').read_text())
# Candidate 10 follows the first two accepted, one-segment links.
current=(native.dump(original+selected[len(original):len(original)+2])+'\n').encode()
assert helper.sha(current)==r['attempts'][10]['input_sha256']
native.D=a.results/'repeat-1'
metadata,candidate=next(helper.native_proposals(current,r['attempts'][9]['row'],r['attempts'][10]['target']))
assert helper.sha(candidate)==r['attempts'][10]['candidate_sha256']
saved=(native.D/'candidate-10/board.kicad_pcb').read_bytes()
before=transaction.identity.design_signature(candidate);after=transaction.identity.design_signature(saved)
out=dict(candidate='candidate-10',candidate_sha256=helper.sha(candidate),saved_sha256=helper.sha(saved),
         removed_node_kinds=[n[0] for n in (before-after).elements()],
         added_node_kinds=[n[0] for n in (after-before).elements()],net_changes=[])
x={native.uid(n):n for n in native.parse(candidate.decode()) if isinstance(n,list) and n[0] in ('segment','via')}
y={native.uid(n):n for n in native.parse(saved.decode()) if isinstance(n,list) and n[0] in ('segment','via')}
for uid in sorted(x.keys()&y.keys()):
    old=native.child(x[uid],'net');new=native.child(y[uid],'net')
    if old!=new:out['net_changes'].append(dict(uuid=uid,before=old,after=new))
assert out['removed_node_kinds']==out['added_node_kinds']==['segment']
assert len(out['net_changes'])==1
a.output.write_text(json.dumps(out,indent=2)+'\n')
print('PASS: retained candidate 10 rewrites one existing track net and must be rejected')
