"""Verify the complete diagnostic native sweep against the previous unchanged control."""
import hashlib,json,sys
from pathlib import Path
from statistics import median
before,after,source,target=map(lambda s:Path(s).resolve(),sys.argv[1:])
if target.exists():raise SystemExit('output exists')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
controls=[json.loads((p/'controls.json').read_text()) for p in [before,after]]
for c in controls:
 assert c['complete'] and c['controls_preserved'] and not c['interrupted'] and not c['smoke']
 assert len(c['order'])==78 and len(c['cases'])==26 and c['seeds']==[1,2,3]
for key in ['version','order','routers','cases','seeds','inputs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','allowed_cpus','safety_stop_seconds']:
 assert controls[0][key]==controls[1][key],key
# Configs contain a source-path override; compare effective settings per attempt below.
actual={k:sha(source/k) for k in controls[1]['candidate']['source_sha256']}
assert actual==controls[1]['candidate']['source_sha256']
different=[k for k in actual if actual[k]!=controls[0]['candidate']['source_sha256'][k]]
assert sorted(different)==['src/route/legalise.ts','src/route/passes.ts'],different
prior={(r['case'],r['seed']):r for r in json.loads((before/'results.json').read_text())}
rows=json.loads((after/'results.json').read_text());assert len(prior)==len(rows)==78
assert len({(r['case'],r['seed']) for r in rows})==78
observations=[]
for row in rows:
 b=prior[(row['case'],row['seed'])];old=before/b['evidence'];new=after/row['evidence']
 for key in ['status','passed','vias','length_mm','opens','new_errors','new_error_types','failed_fidelity']:
  assert b[key]==row[key],(row['case'],row['seed'],key)
 hashes={}
 for name in ['board.dsn','candidate-settings.json','dsn-manifest.json','board.ses']:
  hashes[name]=sha(new/'work'/name);assert hashes[name]==sha(old/'work'/name),(row['case'],row['seed'],name)
 summaries=[json.loads((p/'work/router-summary.json').read_text()) for p in [old,new]]
 for key in ['settings']:
  assert summaries[0][key]==summaries[1][key]
 for key in ['statsBefore','statsAfter']:
  assert summaries[0]['result'][key]==summaries[1]['result'][key]
 records=[json.loads((p/'record.json').read_text()) for p in [old,new]]
 for key in ['checker_sha256','runner_sha256','fixture_sha256','allowed_cpus','cap_s']:
  assert records[0][key]==records[1][key],key
 assert records[1]['allowed_cpus']==list(range(12,20))
 for step in records[1]['steps']:assert step['exit_code']==0 and not step['timed_out']
 observed=json.loads(next(l.removeprefix('GRID_CENSUS ') for l in (new/'route.stdout.log').read_text().splitlines() if l.startswith('GRID_CENSUS ')))
 original=json.loads(next(l.removeprefix('GRID_CENSUS ') for l in (old/'route.stdout.log').read_text().splitlines() if l.startswith('GRID_CENSUS ')))
 assert {k:{f:v for f,v in c.items() if f!='stages'} for k,c in observed.items()}==original,(row['case'],row['seed'],'counters')
 observations.append({**{k:row[k] for k in ['case','seed','passed','opens','new_errors','vias','length_mm']},'before_seconds':b['seconds'],'diagnostic_seconds':row['seconds'],'hashes':hashes})
cases=[]
for case in sorted({r['case'] for r in rows}):
 rr=[r for r in observations if r['case']==case];assert len(rr)==3
 cases.append({'case':case,'passed':sum(r['passed'] for r in rr),'opens':sum(r['opens'] for r in rr),'new_errors':sum(r['new_errors'] for r in rr),
 'before_median_s':median(r['before_seconds'] for r in rr),'diagnostic_median_s':median(r['diagnostic_seconds'] for r in rr),
 'before_p95_s':max(r['before_seconds'] for r in rr),'diagnostic_p95_s':max(r['diagnostic_seconds'] for r in rr),
 'vias_median':median(r['vias'] for r in rr),'length_mm_median':median(r['length_mm'] for r in rr)})
result={'scope':'Full 26x3 diagnostic native verification, historical unchanged control; no performance or rescue gain claimed',
 'all_78_session_quality_and_search_counters_match':True,'changed_diagnostic_files':different,
 'source_commit':controls[1]['candidate']['commit'],'source_sha256':actual,
 'inputs_sha256':controls[1]['inputs_sha256'],'harness_sha256':controls[1]['harness_sha256'],
 'before_utc_start':controls[0]['utc_start'],'before_utc_end':controls[0]['utc_end'],
 'diagnostic_utc_start':controls[1]['utc_start'],'diagnostic_utc_end':controls[1]['utc_end'],
 'passed':sum(r['passed'] for r in rows),'valid_cases_3of3':sum(c['passed']==3 for c in cases),
 'opens':sum(r['opens'] for r in rows),'new_errors':sum(r['new_errors'] for r in rows),
 'before_median_s':median(r['before_seconds'] for r in observations),'diagnostic_median_s':median(r['diagnostic_seconds'] for r in observations),
 'before_p95_s':sorted(r['before_seconds'] for r in observations)[74],'diagnostic_p95_s':sorted(r['diagnostic_seconds'] for r in observations)[74],
 'before_total_s':sum(r['before_seconds'] for r in observations),'diagnostic_total_s':sum(r['diagnostic_seconds'] for r in observations),
 'attempts':observations,'cases':cases}
target.write_text(json.dumps(result,separators=(',',':'))+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['attempts','cases','source_sha256','harness_sha256']},indent=2))
