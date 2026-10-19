"""Check complete paired custom-board native evidence, including error multiplicity."""
from pathlib import Path
from statistics import median
from collections import Counter
import hashlib,json,sys
run,baseline,source,out=map(Path,sys.argv[1:]);assert not out.exists()
rows=json.loads((run/'results.json').read_text());assert len(rows)==6
controls=json.loads((run/'controls.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for version,root in [('before',baseline),('after',source)]:
 assert controls['sources'][version]['src']=={name:sha(root/name)for name in controls['sources'][version]['src']}
assert controls['allowed_cpus']==list(range(12,20))
assert len({(r['version'],r['repeat'])for r in rows})==6
def canonical_warning(x):
 x={k:v for k,v in x.items()if k!='uuid'}
 if 'items'in x:x['items']=sorted([canonical_warning(y)for y in x['items']],key=lambda y:json.dumps(y,sort_keys=True))
 return x
session_hashes={version:sorted({sha(run/'runs'/r['record']['attempt']/'fab-router/work/board.ses')for r in rows if r['version']==version})for version in ['before','after']}
assert all(len(hs)==1 for hs in session_hashes.values())
regressions=[];pairs=[]
for repeat in range(1,4):
 pair=[next(r for r in rows if r['version']==version and r['repeat']==repeat)for version in ['before','after']]
 for row in pair:
  assert row['record']['status']=='checked' and row['check']
  assert row['record']['fixture_sha256']==controls['fixture_sha256']
  assert row['record']['runner_sha256']==controls['runner_sha256']
  assert row['record']['checker_sha256']==rows[0]['record']['checker_sha256']
  assert all(s['exit_code']==0 and not s['timed_out']for s in row['record']['steps'])
  assert row['record']['allowed_cpus']==list(range(12,20))
 dirs=[run/'runs'/r['record']['attempt']/'fab-router'/'work'for r in pair]
 for name in ['board.dsn','dsn-manifest.json']:
  assert sha(dirs[0]/name)==sha(dirs[1]/name),(repeat,name)
 reports=[json.loads((d/'router-summary.json').read_text())['result']['report']for d in dirs]
 effective=[r['effectiveSettings']for r in reports]
 assert effective[0]['localRecovery']is True and effective[1]['localRecovery']is True
 assert effective[0]==effective[1]
 assert {k:v for k,v in effective[0].items()if k!='localRecovery'}=={k:v for k,v in effective[1].items()if k!='localRecovery'}
 a,b=[r['check']for r in pair]
 findings=lambda c:Counter(json.dumps(x,sort_keys=True)for x in c['new_error_details'])
 added=list((findings(b)-findings(a)).elements())
 warnings=lambda c:Counter(json.dumps(canonical_warning(x),sort_keys=True)for x in c['new_warning_details'])
 added_warnings=list((warnings(b)-warnings(a)).elements())
 if added or added_warnings or b['opens']>a['opens']or b['new_errors']>a['new_errors']or (a['pass']and not b['pass'])or a['fidelity']!=b['fidelity']:regressions.append({'repeat':repeat,'introduced_errors':added,'introduced_warning_geometry':added_warnings})
 pairs.append({'repeat':repeat,**{version:{'seconds':row['record']['route_pipeline_seconds'],'passed':row['check']['pass'],'opens':row['check']['opens'],'new_errors':row['check']['new_errors'],'vias':row['check']['vias'],'length_mm':row['check']['length_mm'],'fidelity':row['check']['fidelity'],'report':report,'new_error_details':row['check']['new_error_details'],'warnings':row['check']['new_warning_details']}for version,row,report in zip(['before','after'],pair,reports)}})
summary={}
for version in ['before','after']:
 rr=[r[version]for r in pairs]
 summary[version]={'passed':sum(r['passed']for r in rr),'opens':[r['opens']for r in rr],'new_errors':[r['new_errors']for r in rr],'median_s':median(r['seconds']for r in rr),'p95_s':max(r['seconds']for r in rr),'vias':[r['vias']for r in rr],'length_mm':[r['length_mm']for r in rr],'engine_incomplete':[r['report']['incompleteAfter']for r in rr],'timeouts':[r['report']['timedOut']for r in rr]}
out.write_text(json.dumps({'scope':'Dense6 prepared native case;3repeats/mode;2passes/600s;current versus component-anchor recovery both enabled;not full frozen suite','summary':summary,'regressions':regressions,'session_hashes':session_hashes,'pairs':pairs,'controls':controls},indent=2)+'\n')
print(json.dumps({'summary':summary,'regressions':regressions},indent=2))
