from pathlib import Path
import json,statistics,hashlib
w=Path(__file__).resolve().parent
def strip(x):
 if isinstance(x,dict):return {k:strip(v)for k,v in x.items()if k!='wallClockMs'}
 if isinstance(x,list):return [strip(v)for v in x]
 return x
rows=[]
for pair in range(3):
 values={m:[json.loads(l)for l in (w/f'probe-{pair}-{m}.jsonl').read_text().splitlines()]for m in ['original','candidate']}
 assert all(len(v)==2 for v in values.values())
 for i in range(2):
  a,b=[values[m][i]for m in ['original','candidate']]
  for k in ['settings','input_sha256','ses_sha256','statsBefore','statsAfter','report']:assert strip(a[k])==strip(b[k]),(pair,i,k)
  rows.append({'pair':pair,'route':i,'original_s':a['seconds'],'candidate_s':b['seconds'],'ses_sha256':a['ses_sha256'],'statsAfter':a['statsAfter']})
summary={str(i):{m:{'median_s':statistics.median(r[m+'_s']for r in rows if r['route']==i),'p95_max3_s':max(r[m+'_s']for r in rows if r['route']==i)}for m in ['original','candidate']}for i in range(2)}
(w/'summary.json').write_text(json.dumps({'scope':'Aquarius J4 engine-only replay, 3 alternating pairs, 2 routes per process; not native checks or suite score','all12_geometry_stats_reports_identical_except_wall':True,'timing':summary,'rows':rows},indent=2)+'\n')
print(json.dumps(summary,indent=2))
