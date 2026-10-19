#!/usr/bin/python3
"""Summarize actual native lane findings, including rejected replacements."""
from collections import Counter
import gzip
import json
from pathlib import Path
import sys
import transaction
root=Path(sys.argv[1])
def read(p):return p.read_bytes() if p.exists() else gzip.decompress(Path(str(p)+'.gz').read_bytes())
s=json.loads(read(root/'summary.json'));rows=[]
for r in s['rows']:
    blockers=Counter();attempts=[]
    baseline=transaction.errors(r['baseline'])
    for a in r['attempts']:
        report=json.loads(read(root/a['name']/'drc.json'))
        errors=[v for v in report['violations'] if v['severity']=='error']
        new=list((Counter(json.dumps(e,sort_keys=True) for e in errors)-baseline).elements())
        new=[json.loads(e) for e in new]
        blockers.update(set(e['type'] for e in new))
        lost=transaction.terminals.lost_pairs(r['baseline']['groups'],a['row']['groups']) if a['row'] else None
        target=any(v['type']=='starved_thermal' and any(i['uuid']=='12cbe2ed-3861-4e0e-89f1-6c66f25e5228' for i in v['items']) for v in report['violations'])
        attempts.append(dict(name=a['name'],errors=len(errors),opens=len(report['unconnected_items']),retains_target=target,new_errors=new,lost_pairs=lost,exception=a['exception']))
    rows.append(dict(repeat=r['repeat'],accepted=r['accepted'],blockers=blockers,attempts=attempts))
print(json.dumps(dict(production_fix=False,routing_benchmark=False,rows=rows),indent=2))
