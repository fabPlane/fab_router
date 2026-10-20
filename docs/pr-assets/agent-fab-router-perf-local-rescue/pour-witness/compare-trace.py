"""Verify the charged-work regression and exact restoration, with no timing inference."""
import json,sys
from pathlib import Path
source,out=map(Path,sys.argv[1:]);assert not out.exists()
rows=json.loads(source.read_text())['rows'];assert [r['mode']for r in rows]==['before','v1','v2']
assert len({r['inputSha256']for r in rows})==1
assert rows[0]['settings']==rows[1]['settings']==rows[2]['settings']
for r in rows:
 assert r['report']['violationsAdded']==r['stats']['violations']['total']==0
 assert not r['report']['timedOut']
def targets(row):
 result=[]
 for s in row['logs']:
  if s.startswith('local-recovery result '):
   t=json.loads(s.removeprefix('local-recovery result '));t.pop('seconds',None);result.append(t)
 return result
before,v1,v2=map(targets,rows)
assert len(before)==len(v1)==len(v2)==16
assert before==v2 and rows[0]['sesSha256']==rows[2]['sesSha256']
assert rows[0]['report']['incompleteAfter']==rows[2]['report']['incompleteAfter']==21
assert rows[1]['report']['incompleteAfter']==22
changed=[{'pair':a['pair'],'before':{'status':a['status'],'expansions':a['result']['expansions']},'v1':{'status':b['status'],'expansions':b['result']['expansions']}}for a,b in zip(before,v1)if a!=b]
assert next(t for t in before if t['pair']['net']==7)['status']=='budget'
assert next(t for t in v1 if t['pair']['net']==7)['status']=='kept'
out.write_text(json.dumps({'scope':'Actual recovery traces, original budgets; all 16 v2 targets and SES match control. V1 changes charged work/order outcomes; no speed claim.','changed_v1':changed,'all_v2_targets_match':True,'same_v2_ses':True},indent=2)+'\n')
