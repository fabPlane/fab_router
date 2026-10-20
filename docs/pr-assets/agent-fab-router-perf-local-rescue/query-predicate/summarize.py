from pathlib import Path
import json,statistics,hashlib
w=Path(__file__).resolve().parent
records={name:json.loads((w/f'{name}.json').read_text())for name in ['records','aquarius-records']}
summary={}
for name,rs in records.items():
 assert len(rs)==6
 ref=None
 def untimed(x):
  if isinstance(x,dict):return {k:untimed(v)for k,v in x.items()if k!='seconds'}
  if isinstance(x,list):return [untimed(v)for v in x]
  return x
 def normlog(s):
  prefix='local-recovery result '
  return prefix+json.dumps(untimed(json.loads(s[len(prefix):])),sort_keys=True)if s.startswith(prefix)else s
 for r in rs:
  if name=='records':
   d=w/f"{r['pair']}-{r['mode']}";x=json.loads((d/'result.json').read_text());assert hashlib.sha256((d/'board.ses').read_bytes()).hexdigest()==r['ses_sha256'];assert x['seconds']==r['seconds']
  else:x={k:r[k]for k in ['settings','logs','report','statsBefore','statsAfter','ses_sha256','input_sha256']}
  x.pop('seconds',None);x['report'].pop('wallClockMs',None)
  if 'logs'in x:x['logs']=[normlog(s)for s in x['logs']]
  assert not x['report']['timedOut']and not x['report']['aborted']
  if ref is None:ref=x
  else:assert x==ref,(name,r['pair'],r['mode'])
 assert len({r['ses_sha256']for r in rs})==1
 summary[name]={mode:{'seconds':[r['seconds']for r in rs if r['mode']==mode],'median_s':statistics.median(r['seconds']for r in rs if r['mode']==mode),'p95_max3_s':max(r['seconds']for r in rs if r['mode']==mode),'total_s':sum(r['seconds']for r in rs if r['mode']==mode)}for mode in ['original','candidate']}
 summary[name]['parity']=ref
(w/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:{m:v[m]for m in ['original','candidate']}for k,v in summary.items()},indent=2))
