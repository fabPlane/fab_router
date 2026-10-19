"""Compare complete native enabled control and component-anchor recovery, preserving all findings."""
from pathlib import Path
from collections import Counter
from statistics import median
import json,hashlib,sys
before,after,out=map(Path,sys.argv[1:]);assert not out.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cs=[json.loads((p/'controls.json').read_text())for p in [before,after]]
for c in cs:
 assert c['complete']and c['controls_preserved']and not c['interrupted']and not c['smoke']
 assert len(c['order'])==78 and len(c['cases'])==26 and c['seeds']==[1,2,3]
for key in ['version','order','routers','cases','seeds','inputs_sha256','configs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','allowed_cpus','safety_stop_seconds']:
 assert cs[0][key]==cs[1][key],key
def findings(c):return Counter(json.dumps(x,sort_keys=True)for x in c['new_error_details'])
def canonical(x):
 x={k:v for k,v in x.items()if k!='uuid'}
 if 'items'in x:x['items']=sorted([canonical(y)for y in x['items']],key=lambda y:json.dumps(y,sort_keys=True))
 return x
def warnings(c):return Counter(json.dumps(canonical(x),sort_keys=True)for x in c.get('new_warning_details',[]))
old={(r['case'],r['seed']):r for r in json.loads((before/'results.json').read_text())};new=json.loads((after/'results.json').read_text());assert len(old)==len(new)==78
rows=[];regressions=[]
for b in new:
 a=old[(b['case'],b['seed'])];dirs=[d/r['evidence']for d,r in [(before,a),(after,b)]]
 for name in ['board.dsn','candidate-settings.json','dsn-manifest.json']:assert sha(dirs[0]/'work'/name)==sha(dirs[1]/'work'/name)
 effective=[]
 for d in dirs:
  rec=json.loads((d/'record.json').read_text());assert rec['allowed_cpus']==list(range(12,20))
  assert all(s['exit_code']==0 and not s['timed_out']for s in rec['steps'])
  report=json.loads((d/'work/router-summary.json').read_text())['result']['report'];effective.append(report['effectiveSettings'])
  assert effective[-1]['localRecovery']is True
 assert effective[0]==effective[1]
 added=list((findings(b['check'])-findings(a['check'])).elements());added_warnings=list((warnings(b['check'])-warnings(a['check'])).elements())
 keys=['passed','opens','new_errors','seconds','vias','length_mm','failed_fidelity']
 row={'case':b['case'],'seed':b['seed'],'before':{k:a[k]for k in keys},'after':{k:b[k]for k in keys},'added_findings':added,'added_warning_geometry':added_warnings,'same_ses':sha(dirs[0]/'work/board.ses')==sha(dirs[1]/'work/board.ses')}
 rows.append(row)
 if added or added_warnings or b['opens']>a['opens']or b['new_errors']>a['new_errors']or (a['passed']and not b['passed'])or a['failed_fidelity']!=b['failed_fidelity']:regressions.append(row)
summary={m:{'passed':sum(r[m]['passed']for r in rows),'opens':sum(r[m]['opens']for r in rows),'new_errors':sum(r[m]['new_errors']for r in rows),'median_s':median(r[m]['seconds']for r in rows),'p95_s':sorted(r[m]['seconds']for r in rows)[74],'total_s':sum(r[m]['seconds']for r in rows),'vias':sum(r[m]['vias']for r in rows),'length_mm':sum(r[m]['length_mm']for r in rows)}for m in ['before','after']}
out.write_text(json.dumps({'scope':'Fresh enabled control versus component-anchor recovery; source differs; concurrent unit tests; no causal timing claim','summary':summary,'same_sessions':sum(r['same_ses']for r in rows),'regressions':regressions,'attempts':rows},indent=2)+'\n');print(json.dumps({'summary':summary,'regressions':len(regressions)}))
