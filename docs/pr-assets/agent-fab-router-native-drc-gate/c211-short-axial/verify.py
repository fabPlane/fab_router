import pathlib,json,hashlib,sys,base64
root=pathlib.Path(sys.argv[1]);out={}
for name in ('before','after'):
 p=root/name
 if not (p/'search/result.json').exists():continue
 result=json.loads((p/'search/result.json').read_text());stage=p/'search/stage-0'
 manifest=json.loads((stage/'manifest.json').read_text());rows=[]
 for attempt in result['attempts']:
  f=p/'search'/f"stage-{attempt['stage']}"/(attempt['name']+'.json');d=json.loads(f.read_text())
  rows.append({'name':attempt['name'],'label':attempt['label'],'progress':attempt['progress'],'errors':[e['type'] for e in d['newErrors']],'opens':d['opensAfter'],'lost':d['lostTerminalPairs'],'owned':d['nativeCopperChecks'],'routedAccepted':d['repair']['accepted']})
 assert len(rows)==len(result['attempts'])
 v=result['validation'];out[name]={'published':result['published'],'repaired':result['repaired'],'proposals':len(manifest),'attempts':rows,'errors':[e['type']for e in v['newErrors']],'opens':v['opensAfter'],'lost':v['lostTerminalPairs'],'owned':v['nativeCopperChecks']}
 if result['published']:
  assert v['accepted'] and v['newErrors']==[] and v['lostTerminalPairs']==0 and all(v['nativeCopperChecks']) and v['repair']['accepted']
if set(out)=={'before','after'}:
 a=root/'before/search/stage-0';b=root/'after/search/stage-0'
 old=json.loads((a/'manifest.json').read_text());new=json.loads((b/'manifest.json').read_text());assert new[:len(old)]==old
 for row in old:assert (a/row['name']).read_bytes()==(b/row['name']).read_bytes(),row['name']
 out['prefixIdentical']=len(old)
 assert out['before']['published']==False and out['before']['repaired']==False
 assert len(out['before']['attempts'])==90 and all(not a['progress']for a in out['before']['attempts'])
 assert out['after']['published'] and out['after']['repaired']
 assert out['after']['attempts'][-1]['progress']
 for role in ('input','routed'):
  assert (root/'before/search'/role/'board.kicad_pcb').read_bytes()==(root/'after/search'/role/'board.kicad_pcb').read_bytes()
 bundle=json.loads((root/'after/accepted.json').read_text());assert bundle['format']=='fab-router-native-repair-v1'
 accepted=out['after']['attempts'][-1]
 for role,path in [('input',root/'after/search/input/board.kicad_pcb'),('routed',root/'after/search/routed/board.kicad_pcb'),('candidate',root/'after/search'/f"stage-0/{accepted['name']}")]:
  for file in bundle[role]:assert hashlib.sha256(base64.b64decode(file['base64'])).hexdigest()==file['sha256']
  assert base64.b64decode(bundle[role][0]['base64'])==path.read_bytes()
 out['bundleCandidateSha256']=bundle['validation']['candidateSha256']
 assert out['bundleCandidateSha256']==hashlib.sha256((root/'paired/candidate.kicad_pcb').read_bytes()).hexdigest()
print(json.dumps(out,indent=2))
