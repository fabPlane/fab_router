"""Compare historical and fresh default-off controls; descriptive times only."""
from pathlib import Path
from statistics import median
from collections import Counter
import math,json,hashlib,sys
before,after,out=map(Path,sys.argv[1:])
controls=[json.loads((d/'controls.json').read_text())for d in [before,after]]
for c in controls:assert c['complete'] and c['controls_preserved']and not c['interrupted']and not c['smoke']and len(c['order'])==78
for key in ['version','order','routers','cases','seeds','inputs_sha256','configs_sha256','harness_sha256','runtime_sha256','allowed_cpus','safety_stop_seconds']:assert controls[0][key]==controls[1][key],key
def canonical(v):
 if isinstance(v,dict):return {k:canonical(x)for k,x in v.items()if k!='uuid'}
 if isinstance(v,list):return sorted([canonical(x)for x in v],key=lambda x:json.dumps(x,sort_keys=True))
 return v
def findings(c,key):return Counter(json.dumps(canonical(v),sort_keys=True)for v in c.get(key,[]))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
raw=[json.loads((d/'results.json').read_text())for d in [before,after]]
old={(r['case'],r['seed']):r for r in raw[0]};assert len(old)==len(raw[1])==78
rows=[]
for b in raw[1]:
 a=old[(b['case'],b['seed'])];sessions=[]
 for base,r in [(before,a),(after,b)]:
  work=base/r['evidence']/'work';sessions.append(sha(work/'board.ses'))
  rec=json.loads((work.parent/'record.json').read_text());assert rec['allowed_cpus']==list(range(12,20))
  assert all(s['exit_code']==0 and not s['timed_out']for s in rec['steps'])
  effective=json.loads((work/'router-summary.json').read_text())['result']['report']['effectiveSettings'];assert not effective.get('localRecovery',False)
 for key in ['passed','opens','new_errors','vias','length_mm','failed_fidelity']:assert a[key]==b[key],(b['case'],key)
 for key in ['new_error_details','new_warning_details']:assert findings(a['check'],key)==findings(b['check'],key),(b['case'],key)
 assert len(set(sessions))==1
 rows.append({'case':b['case'],'seed':b['seed'],'before_seconds':a['seconds'],'after_seconds':b['seconds'],'same_ses':True,'ses_sha256':sessions[0]})
def summary(rs):
 times=sorted(r['seconds']for r in rs)
 return {'attempts':len(rs),'passed':sum(r['passed']for r in rs),'valid_cases_3of3':sum(all(r['passed']for r in rs if r['case']==c)for c in set(r['case']for r in rs)),'opens':sum(r['opens']for r in rs),'new_errors':sum(r['new_errors']for r in rs),'vias':sum(r['vias']for r in rs),'length_mm':sum(r['length_mm']for r in rs),'median_s':median(times),'p95_s':times[math.ceil(len(times)*.95)-1],'total_s':sum(times)}
result={'scope':'Historical cycle31 default-off versus fresh cycle39 default-off. Same host/cores, three repeats/case. No candidate engine or causal timing comparison. Unit tests overlap fresh sweep.','before':summary(raw[0]),'after':summary(raw[1]),'same_sessions':78,'introduced_findings':0,'case_rows':[{'case':case,'before':summary([r for r in raw[0]if r['case']==case]),'after':summary([r for r in raw[1]if r['case']==case])}for case in sorted(set(r['case']for r in raw[0]))],'attempts':rows}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['before','after','same_sessions','introduced_findings']}))
