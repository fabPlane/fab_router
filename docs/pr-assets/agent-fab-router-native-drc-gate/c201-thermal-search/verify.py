import base64,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1])
rows=json.loads((root/'measurement.json').read_text())
assert len(rows)==3
for row in rows:
 repeat=row['repeat'];work=root/f'measured-{repeat}';result=json.loads((work/'result.json').read_text());baseline=json.loads((work/'baseline.json').read_text())
 assert len(baseline['newErrors'])==2
 assert result['published'] and result['repaired'] and result['stages']==2
 assert result['validation']['newErrors']==[]
 assert result['validation']['opensAfter']==0
 def pairs(report):
  before,after=report['terminalGroups']['input'],report['terminalGroups']['candidate']
  membership={pad:i for i,group in enumerate(after) for pad in group}
  lost=sum(sum(membership[a]!=membership[b] for b in group[i+1:]) for group in before for i,a in enumerate(group))
  assert lost==report['lostTerminalPairs']
  return lost
 for stage in work.glob('stage-*'):
  if stage.is_dir():
   manifest=json.loads((stage/'manifest.json').read_text());assert len(manifest)<=304
   assert {f.name for f in stage.glob('*.kicad_pcb')}=={r['name'] for r in manifest}
 assert len(list(work.glob('stage-*/*.kicad_pcb.json')))==len(result['attempts'])
 for attempt in result['attempts']:
  check=json.loads((work/f"stage-{attempt['stage']}"/(attempt['name']+'.json')).read_text())
  pairs(check);pairs(check['repair'])
  if attempt['progress']:
   assert not check['lostTerminalPairs'] and check['repair']['accepted']
   assert check['opensAfter']<=check['opensBefore']
   assert all(v['type']=='starved_thermal' for v in check['newErrors'])
   errors=lambda report:sum(v['severity']=='error' for v in report['violations'])
   assert errors(check['candidateReport'])<errors(check['repair']['routedReport'])
 pairs(result['validation']);pairs(result['validation']['repair'])
 bundle=json.loads((root/f'accepted-final-{repeat}.json').read_text())
 assert bundle['format']=='fab-router-native-repair-v1'
 for role in ['input','routed','candidate']:
  for f in bundle[role]:
   data=base64.b64decode(f['base64'],validate=True)
   assert hashlib.sha256(data).hexdigest()==f['sha256']
   if role in ['input','routed']:assert data==(work/role/f['name']).read_bytes()
 candidate=next(f for f in bundle['candidate'] if f['name']=='board.kicad_pcb')
 assert candidate['sha256']==row['candidate_sha256']==result['validation']['candidateSha256']
 assert row['native_checks']==3*len(result['attempts'])+9
print('PASS: three complete searches; independent terminal-pair counts, strict progress, exact bundle hashes and frozen source snapshots')
