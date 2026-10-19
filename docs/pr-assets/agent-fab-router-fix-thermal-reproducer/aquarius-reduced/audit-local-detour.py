#!/usr/bin/python3
"""Summarize measured local detour blockers without treating them as route scores."""
from collections import Counter
import gzip
import json
from pathlib import Path
import sys
root=Path(sys.argv[1])
def read(p):return json.loads(p.read_bytes() if p.exists() else gzip.decompress(Path(str(p)+'.gz').read_bytes()))
result={}
for name in ('u153','u148'):
 s=read(root/name/'summary.json');rows=[]
 for r in s['rows']:
  reasons=Counter()
  base=Counter(json.dumps(e,sort_keys=True) for e in r['baseline']['errors'])
  for attempt in r['attempts']:
   row=attempt['row']
   if row is None:
    reasons['design_or_rule_drift']+=1
    continue
   target=any(e['type']=='starved_thermal' and any(i['uuid']==s['pad_uuid'] for i in e['items']) for e in row['errors'])
   reasons['target_thermal_remains']+=target
   extra=Counter(json.dumps(e,sort_keys=True) for e in row['errors'])-base
   for kind in {json.loads(e)['type'] for e in extra}:reasons['new:'+kind]+=1
   reasons['opens_increased']+=row['opens']>r['baseline']['opens']
   reasons['accepted']+=attempt['accepted']
  rows.append(dict(repeat=r['repeat'],proposals=len(r['attempts']),skipped=len(r['skipped']),reasons=dict(reasons),
                   selected_errors=len(r['baseline']['errors']) if not r['accepted'] else len(r['attempts'][-1]['row']['errors']),
                   selected_opens=r['baseline']['opens'] if not r['accepted'] else r['attempts'][-1]['row']['opens']))
 assert all({k:v for k,v in row.items() if k!='repeat'}=={k:v for k,v in rows[0].items() if k!='repeat'} for row in rows)
 result[name]=rows
(root/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
