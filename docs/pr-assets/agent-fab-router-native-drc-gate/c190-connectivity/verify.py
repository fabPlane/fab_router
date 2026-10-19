"""Compare fresh native reports against the retained same-board control run."""
import json,pathlib,sys,math
old,new=map(pathlib.Path,sys.argv[1:])
drifts=[]
a=json.loads((old/'results.json').read_text());b=json.loads((new/'results.json').read_text())
assert len(a)==len(b)==78
for x,y in zip(a,b):
 for field in ('case','seed','accepted','new_errors','opens_before','opens_after','source_hashes'):
  assert x[field]==y[field],(field,x['case'],x['seed'])
 before=json.loads((old/x['report']).read_text());after=json.loads((new/y['report']).read_text())
 for label in ('inputReport','candidateReport'):
  omit={'date','unconnected_items'}
  assert {k:v for k,v in before[label].items() if k not in omit}=={k:v for k,v in after[label].items() if k not in omit},(label,x['case'])
  if before[label]['unconnected_items']!=after[label]['unconnected_items']:
   drifts.append(dict(case=x['case'],seed=x['seed'],report=label,opens=len(after[label]['unconnected_items'])))
  for c in after[label]['unconnected_items']:
   assert c['type']=='unconnected_items' and c['severity']=='error' and isinstance(c['description'],str) and len(c['items'])>=2
   for i in c['items']:
    assert isinstance(i['description'],str) and all(math.isfinite(i['pos'][k]) for k in ('x','y'))
print(json.dumps(dict(nativeReports=156,unchangedDecisions=78,sourceHashesMatch=True,connectivityWitnessDifferences=drifts),indent=2))
print('PASS: native policy/error findings unchanged; open counts and source hashes identical; all real connectivity entries satisfy strict schema')
