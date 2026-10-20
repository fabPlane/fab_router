"""Verify complete fixture/large/slow evidence and build a compact review table."""
from pathlib import Path
from statistics import median
import json,sys
run,out=map(Path,sys.argv[1:]);assert not out.exists()
fixture=json.loads((run/'fixture.json').read_text());assert len(fixture['rows'])==6
for mode,expected in [('before',1),('after',0)]:
 rr=[r for r in fixture['rows']if r['mode']==mode];assert len(rr)==3 and {r['repeat']for r in rr}=={1,2,3}
 assert all(r['incomplete']==expected and r['violations']==0 and r['unchanged']for r in rr)
 assert len({r['ses']for r in rr})==1
large=json.loads((run/'large.json').read_text());assert len(large['rows'])==18
cases=[];regressions=[]
for file in sorted({r['file']for r in large['rows']}):
 rows=[r for r in large['rows']if r['file']==file];assert len(rows)==6
 assert len({json.dumps(r['settings'],sort_keys=True)for r in rows})==1
 assert len({r['inputSha256']for r in rows})==1
 summary={}
 for mode in ['before','after']:
  rr=[r for r in rows if r['mode']==mode];assert len(rr)==3 and {r['repeat']for r in rr}=={1,2,3}
  for r in rr:
   assert r['report']['effectiveSettings']['localRecovery']is True
   assert not r['report']['timedOut']and not r['report']['aborted']
   assert r['report']['violationsAdded']==0 and r['stats']['violations']['total']==0
  assert len({r['sesSha256']for r in rr})==1
  summary[mode]={'incomplete':[r['report']['incompleteAfter']for r in rr],'vias':[r['stats']['barrels']['total']for r in rr],'length_mm':[r['stats']['tracks']['totalLengthMm']for r in rr],'median_s':median(r['seconds']for r in rr),'p95_s':max(r['seconds']for r in rr)}
 for repeat in [1,2,3]:
  a,b=[next(r for r in rows if r['mode']==m and r['repeat']==repeat)for m in ['before','after']]
  if b['report']['incompleteAfter']>a['report']['incompleteAfter']or b['stats']['barrels']!=a['stats']['barrels']:regressions.append({'file':file,'repeat':repeat})
 cases.append({'file':file,**summary})
slow=json.loads((run/'slow.json').read_text());assert slow['complete']and len(slow['rows'])==slow['total']==63
assert len({r['id']for r in slow['rows']})==63
for r in slow['rows']:
 measured=r['measured']
 assert measured.get('violationsAdded',0)==0 and not measured.get('aborted',False)
 assert not any(k.startswith('invariant:')and v is False for k,v in measured.items())
slow_summary={'cases':63,'passed':sum(r['pass']for r in slow['rows']),'failed':sum(not r['pass']for r in slow['rows']),'advisory':sum(bool(r['advisoryMismatches'])for r in slow['rows']),'stubbed':sum(r['stub']for r in slow['rows']),'total_s':sum(r['ms']for r in slow['rows'])/1000}
# Failures are reported, never reclassified as successful routing.
result={'scope':'Current fixture and larger-input verification; native evidence is separate','fixture':{'before_incomplete':1,'after_incomplete':0,'repeats':3,'exact_violations':0,'retained_unchanged':True},'large':cases,'large_regressions':regressions,'slow':slow_summary}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
