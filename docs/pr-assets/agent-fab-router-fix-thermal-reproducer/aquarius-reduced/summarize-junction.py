#!/usr/bin/python3
"""Classify rejected native junction proposals without changing acceptance."""
from collections import Counter
import gzip
import json
from pathlib import Path
import sys
import transaction
root=Path(sys.argv[1]);path=root/'summary.json'
s=json.loads(path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()))
rows=[]
for r in s['rows']:
    base=r['baseline'];classes=Counter();removals=[]
    for a in r['attempts']:
        if a['exception']:classes['checked_design_rejection']+=1;continue
        row=a['row'];new=transaction.errors(row)-transaction.errors(base)
        classes.update(set(json.loads(e)['type'] for e in new))
        lost=transaction.terminals.lost_pairs(base['groups'],row['groups'])
        if lost:classes['lost_terminal_pairs']+=1
        if row['opens']>base['opens']:classes['increased_opens']+=1
        if row['target']:classes['retained_target']+=1
        else:removals.append(dict(name=a['name'],rank=a['rank'],scale=a['scale'],
            moved=a['moved'],delta_nm=a['delta_nm'],errors=len(row['errors']),opens=row['opens'],
            new_error_types=sorted(set(json.loads(e)['type'] for e in new)),lost_pairs=lost))
    rows.append(dict(repeat=r['repeat'],attempts=len(r['attempts']),accepted=r['accepted'],
        blockers=dict(sorted(classes.items())),target_removals=removals,selected_sha256=r['selected_sha256']))
print(json.dumps(dict(production_fix=False,routing_benchmark=False,rows=rows),indent=2))
