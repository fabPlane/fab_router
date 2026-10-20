import base64,gzip,hashlib,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text())
spec=importlib.util.spec_from_file_location('proposal',root/'before-engine/tools/native-thermal-proposals.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
rows=[];hashes=[]
for phase in ('before','after'):
 for i in range(3):
  d=root/f'native-{phase}-{i}';r=read(d/'search/result.json');b=read(d/'search/baseline.json');s=read(d/'summary.json')
  assert len(b['newErrors'])==1 and b['newErrors'][0]['type']=='starved_thermal'
  assert b['opensBefore']==110 and b['opensAfter']==111 and b['lostTerminalPairs']==0
  v=r['validation'];assert v['lostTerminalPairs']==v['repair']['lostTerminalPairs']==0
  assert v['repair']['accepted']
  assert r['published']==r['repaired']==(phase=='after')
  assert len(r['attempts'])==(1 if phase=='after' else 0)
  assert len(v['newErrors'])==(0 if phase=='after' else 1)
  assert v['opensAfter']==(110 if phase=='after' else 111)
  assert (d/'source.kicad_pcb').read_bytes()==(d/'search/input/board.kicad_pcb').read_bytes()
  assert (d/'routed.kicad_pcb').read_bytes()==(d/'search/routed/board.kicad_pcb').read_bytes()
  for role in ('source','routed'):
   for ext in ('.kicad_pro','.kicad_dru'):
    assert (d/(role+ext)).read_bytes()==(d/'search/input'/('board'+ext)).read_bytes()
  manifest=read(d/'search/stage-0/manifest.json');assert len(manifest)==(6 if phase=='after' else 0)
  if phase=='after':
   bundle=read(d/'accepted.json');assert bundle['validation']['accepted']
   for role in ('input','routed','candidate'):
    for item in bundle[role]:
     data=base64.b64decode(item['base64']);assert hashlib.sha256(data).hexdigest()==item['sha256']
   data=base64.b64decode(bundle['candidate'][0]['base64']);assert data==(d/'search/stage-0/000.kicad_pcb').read_bytes()
   hashes.append(hashlib.sha256(data).hexdigest())
   # Source items must occur unchanged; all generated copper is three connected
   # segments with the exact endpoint pair and physical attributes of the witness.
   source=m.parse((d/'source.kicad_pcb').read_text());candidate=m.parse(data.decode());routed=m.parse((d/'routed.kicad_pcb').read_text())
   for item in source[1:]:assert item in candidate
   new=[n for n in candidate if isinstance(n,list) and n[0]=='segment' and n not in source]
   old=[n for n in routed if isinstance(n,list) and n[0]=='segment' and n not in source]
   assert len(new)==3 and len(old)==1
   for n in new:
    for key in ('net','layer','width'):assert m.child(n,key)==m.child(old[0],key)
   ends=[tuple(m.child(n,k)[1:]) for n in new for k in ('start','end')]
   from decimal import Decimal
   from collections import Counter
   counts=Counter(tuple(Decimal(v) for v in p) for p in ends)
   outer={p for p,n in counts.items() if n==1}
   assert outer=={tuple(Decimal(v) for v in m.child(old[0],k)[1:]) for k in ('start','end')}
   assert sorted(counts.values())==[1,1,2,2]
  else:assert not (d/'accepted.json').exists()
  rows.append(s)
assert len(set(hashes))==1
result={'rows':rows,'deterministic_candidate_sha256':hashes[0],'source_geometry_and_rules_preserved':True,'source_and_routed_pairs_preserved':True}
(root/'native-comparison.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
