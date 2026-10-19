"""Verify three paired residual replays and bind them to prior native session bytes."""
from pathlib import Path
import hashlib,json,sys,tarfile
repo,scratch=map(lambda s:Path(s).resolve(),sys.argv[1:]);asset=repo/'docs/pr-assets/agent-fab-router-perf-local-rescue'
results=json.loads((scratch/'replay/results.json').read_text());rows=[]
with tarfile.open(asset/'point-component-probe/native-probe-evidence.tar.gz')as native:
 for row in results['rows']:
  repeat=row['repeat'];old=json.loads((scratch/f'before-{repeat}/probe.json').read_text())['rows'][0]
  assert old['settings']==results['fixture']['settings']
  assert old['dsnSha256']==results['fixture']['dsnSha256']
  # The committed fixture is the canonical writeSes of the saved native input.
  assert old['beforeSha256']==results['fixture']['sesSha256']
  result=row['result'];trials=old['targets'][0]['trials']
  assert row['beforeOpen']==1 and row['afterOpen']==0 and row['exact']==0
  assert result['status']=='kept' and result['work']==18890 and result['enumeration']==124
  assert len(trials)==len(result['attempts'])==2
  for before,after in zip(trials,result['attempts']):
   assert before['result']==after['result'] and before['proposals']==after['proposals']
   assert all(before['anchor'][k]==after['anchor'][k]for k in ('net','from','to'))
  for mode in ('before','after'):
   data=(scratch/f'replay/repeat{repeat}-{mode}.ses').read_bytes()
   assert data==(scratch/f'before-{repeat}/photon-sprinkler-sprinkler-j3-{mode}.ses').read_bytes()
   assert hashlib.sha256(data).hexdigest()==row[mode+'Sha256']
   for previous in range(1,4):
    member=native.extractfile(f'native-probe/{mode}-{previous}/board.ses');assert member is not None
    assert data==member.read()
  rows.append({'repeat':repeat,'beforeOpen':1,'afterOpen':0,'searchExpansionsBefore':sum(t['result']['expansions']for t in trials),
   'searchExpansionsAfter':result['work']-result['enumeration'],'enumerationChargedAfter':result['enumeration'],
   'allSearchTrialsAndProposalsEqual':True,'sessionBytesEqual':True,'beforeSha256':row['beforeSha256'],'afterSha256':row['afterSha256']})
assert len(rows)==3
print(json.dumps({'scope':'Fresh paired static engine replays; byte binding to six previously checked native sessions, no new native checks or router benchmark', 'rows':rows},indent=2))
