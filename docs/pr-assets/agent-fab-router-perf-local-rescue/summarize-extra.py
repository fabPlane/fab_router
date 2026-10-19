"""Retain bounded larger-input runs, dense native checks, and separate CPU profiles."""
import argparse,collections,hashlib,json
from pathlib import Path
from statistics import median
p=argparse.ArgumentParser(description=__doc__);p.add_argument('scratch',type=Path);p.add_argument('out',type=Path)
a=p.parse_args();output=a.out/'extra-measurements.json';assert not output.exists()
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
large=[]
for f in sorted(a.scratch.glob('cycle17-large-*.json')):
 r=json.loads(f.read_text());r['raw_sha256']=sha(f);r['result_file']=f.name
 assert sha(Path(r['input']))==r['input_sha256']
 assert sha(f.with_name(f.name+'.ses'))==r['ses_sha256']
 large.append(r)
assert len(large)==12
for name in ['l2.dsn','l3-cycle18.dsn']:
 rr=[r for r in large if Path(r['input']).name==name];assert len(rr)==6
 settings=[]
 for r in rr:
  cfg=dict(r['settings'])
  if r['enabled']=='on':assert cfg.pop('localRescue') is True
  settings.append(cfg)
 assert all(s==settings[0] for s in settings)
dense_root=a.scratch/'cycle17-dense-native';dense=json.loads((dense_root/'results.json').read_text());assert len(dense)==6
for r in dense:
 work=dense_root/'runs'/r['record']['attempt']/'fab-router/work'
 r['engine']=json.loads((work/'router-summary.json').read_text())
 r['ses_sha256']=sha(work/'board.ses')
 assert r['record']['allowed_cpus']==list(range(12,20))
for r in dense:
 other=next(x for x in dense if x['version']!=r['version'] and x['repeat']==r['repeat'])
 assert r['record']['fixture_sha256']==other['record']['fixture_sha256']
 settings=dict(r['engine']['settings']);other_settings=dict(other['engine']['settings'])
 if r['version']=='after':assert settings.pop('localRescue') is True
 else:assert other_settings.pop('localRescue') is True
 assert settings==other_settings
profiles=[]
for version in ['before','after']:
 for repeat in range(1,4):
  log=a.scratch/f'cycle17-profile-{version}-{repeat}.log'
  records=[json.loads(line) for line in log.read_text().splitlines() if line.startswith('{')];assert len(records)==1
  record=records[0];record.update(version=version,repeat=repeat,raw_log_sha256=sha(log))
  files=list((a.scratch/f'cycle17-profile-{version}-{repeat}').glob('*.cpuprofile'));assert len(files)==1
  cpu=json.loads(files[0].read_text());nodes={n['id']:n for n in cpu['nodes']};counts=collections.Counter(cpu['samples'])
  self_counts=collections.Counter()
  for node_id,n in nodes.items():
   cf=n['callFrame'];key=f"{cf['functionName']} {cf.get('url','')}:{cf.get('lineNumber',-1)+1}"
   self_counts[key]+=counts[node_id]
  record.update(cpu_sha256=sha(files[0]),cpu_samples=len(cpu['samples']),top_self=self_counts.most_common(25))
  native=json.loads((a.out/'native-measurements.json').read_text())['attempts']
  reference=next(r for r in native if r['case']=='paperino-hw-paperino-shield-j4' and r['version']==version and r['seed']==2)
  record['matches_native_seed2_ses']=record['ses_sha256']==reference['ses_sha256']
  assert record['input_sha256']==reference['input_sha256']
  assert record['settings']==reference['effective_settings']
  profiles.append(record)
result={'large':large,'dense':dense,'dense_controls':json.loads((dense_root/'controls.json').read_text()),'profiles':profiles}
output.write_text(json.dumps(result,indent=2)+'\n')
for name in ['l2.dsn','l3-cycle18.dsn']:
 for mode in ['off','on']:
  rr=[r for r in large if Path(r['input']).name==name and r['enabled']==mode]
  print(name,mode,median(r['seconds'] for r in rr),[(r['report']['incompleteAfter'],r['report']['violationsAdded'],r['report']['timedOut']) for r in rr])
for v in ['before','after']:
 rr=[r for r in dense if r['version']==v];print('dense',v,[(r['check']['opens'],r['check']['new_errors'],r['record']['route_pipeline_seconds']) for r in rr])
 rr=[r for r in profiles if r['version']==v];print('profile',v,median(r['seconds'] for r in rr),[r['matches_native_seed2_ses'] for r in rr])
