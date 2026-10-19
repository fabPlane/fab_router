import pathlib,json,base64,hashlib,itertools,sys
root=pathlib.Path(sys.argv[1]);rows=json.loads((root/'native/results.json').read_text());assert len(rows)==78
controls=json.loads((root/'controls/results.json').read_text());assert len(controls)==6
checks=0
for d in sorted((root/'native').iterdir())+sorted((root/'controls').iterdir()):
 if not d.is_dir():continue
 for phase in ['before','after']:
  r=json.loads((d/(phase+'.json')).read_text())
  candidate=d/('candidate' if (d/'candidate').exists() else 'repaired')/'board.kicad_pcb'
  assert hashlib.sha256((d/'input/board.kicad_pcb').read_bytes()).hexdigest()==r['inputSha256']
  assert hashlib.sha256(candidate.read_bytes()).hexdigest()==r['candidateSha256']
  if phase=='after':
   routed=d/('routed' if (d/'routed').exists() else 'candidate')/'board.kicad_pcb'
   assert hashlib.sha256(routed.read_bytes()).hexdigest()==r['repair']['routedSha256']
  def pairs(groups):return {tuple(sorted(pair)) for members in groups for pair in itertools.combinations(members,2)}
  for v in [r]+([r['repair']] if phase=='after' else []):
   g=v['terminalGroups'];lost=pairs(g['input'])-pairs(g['candidate']);assert len(lost)==v['lostTerminalPairs'];assert all(tuple(sorted(w)) in lost for w in v['lostPairWitnesses'])
  assert r['published']==r['accepted']==(d/(phase+'.bundle.json')).exists()
  checks+=2 if phase=='before' else 3
  if not r['published']:continue
  b=json.loads((d/(phase+'.bundle.json')).read_text());assert b['validation']=={k:v for k,v in r.items() if k!='published'}
  for role in ['input','candidate']+(['routed'] if phase=='after' else []):
   local=role if (d/role).exists() else 'repaired' if role=='candidate' else 'candidate'
   for f in b[role]:
    data=base64.b64decode(f['base64'],validate=True);assert hashlib.sha256(data).hexdigest()==f['sha256'];assert data==(d/local/f['name']).read_bytes()
print(f'PASS: {len(rows)} corpus pairs, {len(controls)} controls, {checks} native reports; partitions and exact bundle snapshots verified')
