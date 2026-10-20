"""Validate paired controls, then retain outcomes even when the experiment regresses."""
import argparse,json,hashlib,subprocess
from pathlib import Path
from statistics import median
p=argparse.ArgumentParser(description=__doc__);p.add_argument('run',type=Path);p.add_argument('out',type=Path)
a=p.parse_args();assert not any((a.out/f).exists() for f in ['native-measurements.json','native-tables.md']);schedule=json.loads((a.run/'schedule.json').read_text());rows=[];controls={};identity=None
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for version in ['before','after']:
 dirs=sorted(d for d in (a.run/version).iterdir() if d.is_dir());assert len(dirs)==26
 controls[version]={}
 for d in dirs:
  assert json.loads((d/'summary.json').read_text())['complete']
  c=json.loads((d/'controls.json').read_text());controls[version][d.name]=c
  stable={k:c[k] for k in ['version','inputs_sha256','harness_sha256','runtime_sha256','allowed_cpus','runtime_source_sha256']}
  if identity is None:identity=stable
  assert stable==identity,(version,d.name,'shared controls differ')
  assert c['allowed_cpus']==list(range(12,20))
  source=c['candidate']
  assert source==next(iter(controls[version].values()))['candidate']
  if d==dirs[0]:
   for f,h in source['source_sha256'].items():
    actual=subprocess.check_output(['git','-C',source['path'],'show',f"{source['commit']}:{f}"])
    assert hashlib.sha256(actual).hexdigest()==h,(f,'not committed measured source')
  results=json.loads((d/'results.json').read_text());assert len(results)==3 and {r['seed'] for r in results}=={1,2,3}
  for r in results:
   work=d/r['evidence']/'work'
   checked=json.loads((d/r['evidence']/'check.json').read_text())
   for field in ['opens','new_errors','vias','length_mm']:
    assert r[field]==checked[field],(version,d.name,field,'result/check mismatch')
   settings=json.loads((work/'candidate-settings.json').read_text())
   summary=json.loads((work/'router-summary.json').read_text());assert summary['result']['ok']
   report=summary['result']['report']
   rows.append({**{k:r[k] for k in ['case','seed','status','passed','seconds','opens','new_errors','new_error_types','vias','length_mm','failed_fidelity']},'version':version,'input_sha256':sha(work/'board.dsn'),'ses_sha256':sha(work/'board.ses'),'candidate_settings':settings,'effective_settings':summary['settings'],'report':report,'utc_start':c['utc_start'],'utc_end':c['utc_end']})
before={(r['case'],r['seed']):r for r in rows if r['version']=='before'}
after={(r['case'],r['seed']):r for r in rows if r['version']=='after'}
assert before.keys()==after.keys() and len(before)==78
regressions=[];changes=[]
for key,b in before.items():
 r=after[key];assert r['input_sha256']==b['input_sha256']
 for field in ['candidate_settings','effective_settings']:
  rc=json.loads(json.dumps(r[field]));bc=b[field]
  if field=='candidate_settings':assert rc['settings'].pop('localRescue') is True
  else:assert rc.pop('localRescue') is True
  assert rc==bc,(key,field,'unexpected config change')
 assert controls['before'][key[0]]['order']==controls['after'][key[0]]['order']
 if any(r[k]!=b[k] for k in ['passed','opens','new_errors','vias','length_mm','ses_sha256']):changes.append(key)
 if r['opens']>b['opens'] or r['new_errors']>b['new_errors'] or (b['passed'] and not r['passed']) or r['failed_fidelity'] or r['status']!='checked' or r['report']['violationsAdded']>b['report']['violationsAdded']:regressions.append(key)
previous=None
for i,case in enumerate(schedule['cases']):
 for v in (['before','after'] if (i%2==0)!=schedule['reverse_order'] else ['after','before']):
  c=controls[v][case];assert previous is None or previous<=c['utc_start'];assert c['utc_start']<=c['utc_end'];previous=c['utc_end']
aggregates={}
for version in ['before','after']:
 rr=[r for r in rows if r['version']==version]
 aggregates[version]={'passed':sum(r['passed'] for r in rr),'valid_cases_3of3':sum(all(r['passed'] for r in rr if r['case']==case) for case in schedule['cases']),'opens':sum(r['opens'] for r in rr),'new_errors':sum(r['new_errors'] for r in rr),'median_route_s':median(r['seconds'] for r in rr),'sum_case_medians_s':sum(median(r['seconds'] for r in rr if r['case']==case) for case in schedule['cases']),'total_route_s':sum(r['seconds'] for r in rr),'p95_route_s':sorted(r['seconds'] for r in rr)[74]}
compact_controls={v:{case:{**{k:c[k] for k in ['candidate','utc_start','utc_end','order','configs_sha256','command','load_before','load_after']},'raw_controls_sha256':sha(a.run/v/case/'controls.json')} for case,c in cc.items()} for v,cc in controls.items()}
summary={'identity':identity,'schedule':schedule,'aggregates':aggregates,'changed_attempts':changes,'regressions':regressions,'attempts':rows,'controls':compact_controls}
lines=['| Case | Before median / p95 s | After median / p95 s | Pass before → after | Opens before → after | New errors before → after | Vias median before → after | Length mm median before → after |','|---|---:|---:|---:|---:|---:|---:|---:|']
for case in schedule['cases']:
 br=[r for r in rows if r['version']=='before' and r['case']==case];ar=[r for r in rows if r['version']=='after' and r['case']==case]
 pair=lambda field,fn: f'{fn([r[field] for r in br])} → {fn([r[field] for r in ar])}'
 lines.append(f"| {case} | {median(r['seconds'] for r in br):.3f} / {max(r['seconds'] for r in br):.3f} | {median(r['seconds'] for r in ar):.3f} / {max(r['seconds'] for r in ar):.3f} | {pair('passed',sum)} | {pair('opens',sum)} | {pair('new_errors',sum)} | {pair('vias',median)} | {pair('length_mm',lambda v:round(median(v),3))} |")
a.out.mkdir(exist_ok=True,parents=True)
for name,data in [('native-measurements.json',json.dumps(summary,indent=2)+'\n'),('native-tables.md','\n'.join(lines)+'\n')]:
 with (a.out/name).open('x') as f:f.write(data)
print(json.dumps(aggregates,indent=2));print('regressions',regressions,'changed',len(changes))
