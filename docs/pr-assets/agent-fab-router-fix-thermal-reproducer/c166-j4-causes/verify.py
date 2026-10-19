#!/usr/bin/python3
"""Replay retained native reduction evidence; does not authenticate native reports."""
import argparse, gzip, hashlib, importlib.util, json
from collections import Counter
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'c165-thermal-causes/isolate.py'
s=importlib.util.spec_from_file_location('isolate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a=argparse.ArgumentParser(description=__doc__);a.add_argument('--input',type=Path,required=True);a.add_argument('--results',type=Path,required=True);a.add_argument('--out',type=Path,required=True);x=a.parse_args()
z=json.loads((x.results/'summary.json').read_text());nodes=m.native.parse(x.input.read_text());byid={i['uuid']:i['node'] for i in z['added']}
assert len(byid)==len(z['added'])==153
assert len(z['minimal'])==1, 'this retained witness has exactly one causal segment'
assert hashlib.sha256(x.input.read_bytes()).hexdigest() in z['source_sha256'].values()
seen={};controls=[]
for index,row in enumerate(z['rows']):
 d=x.results/row['name'];assert row['name'].startswith(f'{index:03}-')
 proposal=gzip.decompress((d/'proposal.kicad_pcb.gz').read_bytes())
 assert proposal==(m.native.dump(nodes+[byid[i] for i in row['selected']])+'\n').encode()
 saved=(d/'board.kicad_pcb').read_bytes()
 assert hashlib.sha256(proposal).hexdigest()==row['proposed_sha256']
 assert hashlib.sha256(saved).hexdigest()==row['saved_sha256']
 assert (m.identity.design_signature(proposal)==m.identity.design_signature(saved))==row['design_preserved']
 for ext in ['.kicad_pro','.kicad_dru']:assert (d/('board'+ext)).read_bytes()==x.input.with_suffix(ext).read_bytes()
 report=json.loads((d/'drc.json').read_text());errors=[e for e in report['violations'] if e['severity']=='error']
 assert errors==row['errors'] and len(report['unconnected_items'])==row['opens']
 if '-control-' in row['name']:
  label=row['name'].split('-control-',1)[1].rsplit('-',1)[0]
  canonical=(row['selected'],Counter(json.dumps(e,sort_keys=True) for e in errors),row['opens'],row['design_preserved'])
  if label in seen:assert seen[label]==canonical
  seen[label]=canonical;controls.append(row)
assert len(controls)==3*(3+len(z['minimal']))
assert seen['original'][0]==[] and not seen['original'][1]
assert seen['all'][0]==list(byid) and seen['all'][3]
assert seen['minimal'][0]==z['minimal'] and seen['minimal'][3] and seen['minimal'][1]==seen['all'][1]
# Minimality is deletion-local, not a global minimum across 2**153 subsets.
removals=[r for r in controls if '-control-remove-' in r['name']]
assert {tuple(r['selected']) for r in removals}=={tuple(i for i in z['minimal'] if i!=removed) for removed in z['minimal']}
for r in removals:assert not (r['design_preserved'] and Counter(json.dumps(e,sort_keys=True) for e in r['errors'])==seen['all'][1])
out=dict(checks=len(z['rows']),drifts=sum(not r['design_preserved'] for r in z['rows']),minimal=z['minimal'],controls=[dict(name=r['name'],selected=r['selected'],errors=r['errors'],opens=r['opens'],design_preserved=r['design_preserved']) for r in controls],production_fix=False,routing_benchmark=False)
x.out.write_text(json.dumps(out,indent=2)+'\n');print('PASS',out['checks'],'checks;',out['drifts'],'saved design drifts')
