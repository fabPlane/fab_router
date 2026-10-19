"""Summarise actual trial nets and parent stages without claiming retained copper."""
import collections,json,sys
from pathlib import Path
root=Path(sys.argv[1]);target=Path(sys.argv[2])
if target.exists():raise SystemExit('output exists')
rows=json.loads((root/'trial-results.json').read_text());out=[]
for row in rows:
 trials=row['trials'];byid={t['id']:t for t in trials}
 inserts=[t for t in trials if t['kind']=='insertTrail']
 record={k:v for k,v in row.items() if k!='trials'}
 for label,subset in [('owner_net',[t for t in inserts if t['net']==row['netId']]),('other_net',[t for t in inserts if t['net']!=row['netId']])]:
  failures=[t for t in subset if not t['ok']]
  blockers=[b for t in failures for b in t['blocked']]
  record[label]={'trials':len(subset),'legalised':sum(t['ok'] for t in subset),'rejected':len(failures),
   'parent_stages':dict(collections.Counter(byid[t['parent']]['kind'] if t['parent'] else 'outside_wrapped_stage' for t in subset)),
   'failed_variant_first_segments':len(blockers),
   'failed_variant_endpoint_segments':sum(b['index'] in [0,b['legs']-1] for b in blockers),
   'failed_variant_interior_segments':sum(b['index'] not in [0,b['legs']-1] for b in blockers),
   'blocked_ids':dict(collections.Counter(str(i) for b in blockers for i in b['blocking'])),
   'first_rejected_trial':failures[0] if failures else None}
 successful=[t for t in inserts if t['ok']]
 ancestry=collections.Counter()
 for t in successful:
  chain=[];parent=t['parent']
  while parent is not None:
   ancestor=byid[parent];chain.append(ancestor);parent=ancestor['parent']
  assert chain and chain[-1]['kind']=='routeConnection' and not chain[-1]['ok']
  failed=next((a for a in chain if not a['ok'] and a['kind']!='routeConnection'),None)
  ancestry[failed['kind'] if failed else 'routeConnection_only']+=1
 record['successful_trail_nearest_failed_ancestor']=dict(ancestry)
 record['connection_calls']=sum(t['kind']=='routeConnection' for t in trials)
 record['layered']=[{k:t[k] for k in ['id','parent','net','ok']} for t in trials if t['kind']=='insertLayeredTrail']
 out.append(record)
target.write_text(json.dumps(out,indent=2)+'\n')
for r in out:print(r['case'],r['net'],json.dumps({k:r[k] for k in ['owner_net','other_net']},separators=(',',':')))
