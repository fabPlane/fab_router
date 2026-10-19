"""Compare complete 26x3 normal and explicit research-adapter native sweeps.
Both complete runs required; reports regressions instead of discarding attempts.
"""
import hashlib,json,sys
from pathlib import Path
from statistics import median
before,after,source,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);assert not out.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
controls=[json.loads((p/'controls.json').read_text()) for p in [before,after]]
for c in controls:
 assert c['complete'] and c['controls_preserved'] and not c['interrupted'] and not c['smoke']
 assert len(c['order'])==78 and len(c['cases'])==26 and c['seeds']==[1,2,3]
for key in ['version','order','routers','cases','seeds','inputs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','allowed_cpus','safety_stop_seconds']:
 assert controls[0][key]==controls[1][key],key
for i,p in enumerate([source,source/'docs/pr-assets/agent-fab-router-perf-local-rescue/candidate']):
 assert {n:sha(p/n)for n in controls[i]['candidate']['source_sha256']}==controls[i]['candidate']['source_sha256']
snapshot=json.loads((source/'docs/pr-assets/agent-fab-router-perf-local-rescue/remaining-checks/source-hashes.json').read_text())
assert all(sha(source/n)==v for n,v in snapshot.items())
old={(r['case'],r['seed']):r for r in json.loads((before/'results.json').read_text())}
new=json.loads((after/'results.json').read_text());assert len(old)==len(new)==78
assert len({(r['case'],r['seed'])for r in new})==78
rows=[]
for r in new:
 b=old[(r['case'],r['seed'])];d0=before/b['evidence'];d1=after/r['evidence']
 for name in ['board.dsn','candidate-settings.json','dsn-manifest.json']:
  assert sha(d0/'work'/name)==sha(d1/'work'/name),(r['case'],r['seed'],name)
 for d in [d0,d1]:
  record=json.loads((d/'record.json').read_text())
  assert record['allowed_cpus']==list(range(12,20))
  assert all(s['exit_code']==0 and not s['timed_out']for s in record['steps'])
 settings=[json.loads((d/'work/router-summary.json').read_text())['settings']for d in [d0,d1]];assert settings[0]==settings[1]
 keys=['status','passed','seconds','vias','length_mm','opens','new_errors','new_error_types','failed_fidelity']
 rows.append({'case':r['case'],'seed':r['seed'],'before':{k:b[k]for k in keys},'after':{k:r[k]for k in keys},'same_ses':sha(d0/'work/board.ses')==sha(d1/'work/board.ses')})
regressions=[r for r in rows if r['after']['opens']>r['before']['opens'] or r['after']['new_errors']>r['before']['new_errors'] or (r['before']['passed']and not r['after']['passed']) or r['after']['failed_fidelity']!=r['before']['failed_fidelity']]
cases=[]
for name in sorted({r['case']for r in rows}):
 rr=[r for r in rows if r['case']==name];assert len(rr)==3
 cases.append({'case':name,**{mode:{'passed':sum(r[mode]['passed']for r in rr),'opens':sum(r[mode]['opens']for r in rr),'new_errors':sum(r[mode]['new_errors']for r in rr),'median_s':median(r[mode]['seconds']for r in rr),'p95_s':max(r[mode]['seconds']for r in rr),'vias_median':median(r[mode]['vias']for r in rr),'length_mm_median':median(r[mode]['length_mm']for r in rr)}for mode in ['before','after']}})
summary={mode:{'passed':sum(r[mode]['passed']for r in rows),'valid_cases_3of3':sum(c[mode]['passed']==3 for c in cases),'opens':sum(r[mode]['opens']for r in rows),'new_errors':sum(r[mode]['new_errors']for r in rows),'median_s':median(r[mode]['seconds']for r in rows),'p95_s':sorted(r[mode]['seconds']for r in rows)[74],'total_s':sum(r[mode]['seconds']for r in rows)}for mode in ['before','after']}
result={'scope':'Complete native comparison of normal engine with explicit research adapter; production default unchanged','summary':summary,'regressions':regressions,'same_sessions':sum(r['same_ses']for r in rows),'cases':cases,'attempts':rows,'controls':controls,'supplemental_source_sha256':snapshot}
out.write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps({'summary':summary,'regression_attempts':len(regressions),'same_sessions':result['same_sessions']},indent=2))
