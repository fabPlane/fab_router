"""Independent Decimal-based replay of retained native ownership audits."""
import collections,decimal,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sx',root/'native-thermal-proposals.py');sx=importlib.util.module_from_spec(spec);sys.modules[spec.name]=sx;spec.loader.exec_module(sx)
def atom(v):
 if v.startswith('"'):return v
 try:return str(decimal.Decimal(v).normalize())
 except decimal.InvalidOperation:return v
def inventory(path):
 b=sx.parse(path.read_text());nets={'0':'""'}
 for n in b:
  if isinstance(n,list) and n[0]=='net':nets[n[1]]=n[2]
 result=[]
 for n in b:
  if not isinstance(n,list) or n[0] not in ('segment','arc','via'):continue
  net=sx.child(n,'net');name=net[1] if net else '""'
  if not name.startswith('"'):name=nets[name]
  fields=[]
  for f in n[1:]:
   if not isinstance(f,list) or f[0] not in ('start','end','mid','at','width','size','drill','layer','layers'):continue
   head='endpoint' if n[0] in ('segment','arc') and f[0] in ('start','end') else f[0]
   fields.append((head,*map(atom,f[1:])))
  result.append(repr((n[0],name,sorted(fields))))
 return collections.Counter(result)
rows=json.loads((root/'audit-results.json').read_text());roles=json.loads((root/'audit-roles-results.json').read_text());assert len(rows)==78 and len(roles)==104
for row in rows+roles:
 d=root/('audit-roles' if 'role' in row else 'audit')/f"{row['case']}-{row['seed']}"
 if 'role' in row:d/=row['role']
 assert inventory(d/'submitted.kicad_pcb')==inventory(d/'board.kicad_pcb'),d
 assert row['preserved']
 report=json.loads((d/'report.json').read_text());assert report['kicad_version']=='10.0.6' and 'error' in report['included_severities']
measure=json.loads((root/'measurement.json').read_text());assert len(measure)==12
for row in measure:
 assert row['accepted']==(row['phase']=='before' or row['mode']=='control')
 assert row['errors']==row['opens']==row['lostPairs']==0
old=inventory(root/'axial/candidate.kicad_pcb');saved=inventory(root/'axial/native/board.kicad_pcb')
removed=old-saved;added=saved-old
assert sum(removed.values())==sum(added.values())==3
assert collections.Counter({key.replace('Net-(C1-Pad1)','Net-(R1-Pad1)'):count for key,count in removed.items()})==added
for phase in ('before','after'):
 for repeat in range(3):
  v=json.loads((root/'axial'/f'{phase}-{repeat}.json').read_text())
  assert v['accepted']==(phase=='before') and v['newErrors']==[] and v['opensAfter']==110
  assert v['lostTerminalPairs']==v['repair']['lostTerminalPairs']==0
  if phase=='after':assert v['nativeCopperChecks']==[True,False,True] and not v['repair']['accepted']
search=json.loads((root/'axial-search-result.json').read_text())
assert not search['published'] and not search['repaired'] and len(search['attempts'])==6 and all(not a['progress'] for a in search['attempts'])
unsafe=0
for p in (root/'axial-search/stage-0').glob('*.kicad_pcb.json'):
 v=json.loads(p.read_text())
 if not v['newErrors']:
  unsafe+=1;assert v['nativeCopperChecks']==[True,False,True] and not v['accepted'] and not v['repair']['accepted']
 else:assert v['newErrors'][0]['type']=='starved_thermal'
assert unsafe==3
repairs=json.loads((root/'repair-recheck-results.json').read_text());assert len(repairs)==6
for row in repairs:
 assert row['published'] and row['repaired'] and row['candidateSha256']==row['oldCandidateSha256'] and row['attempts']==row['oldAttempts']
 assert row['errors']==row['opens']==row['lostSource']==row['lostRouted']==0
 d=root/'repair-recheck'/f"{row['case']}-{row['seed']}"
 bundle=json.loads((d/'accepted.json').read_text());import base64,hashlib
 assert bundle['validation']['nativeCopperChecks']==[True,True,True]
 assert hashlib.sha256(base64.b64decode(bundle['candidate'][0]['base64'])).hexdigest()==row['candidateSha256']
 result=json.loads((d/'search/result.json').read_text())
 old_result=json.loads((d/'old-search-result.json').read_text())
 sequence=lambda v:[(a['stage'],a['name'],a['progress']) for a in v['attempts']]
 assert row['sameProgressSequence'] and sequence(old_result)==sequence(result)
 for checkpoint in row['acceptedCheckpoints']:
  path=pathlib.Path(f"stage-{checkpoint['stage']}")/checkpoint['name']
  assert (d/'old-progress'/path).read_bytes()==(d/'search'/path).read_bytes()
  assert hashlib.sha256((d/'search'/path).read_bytes()).hexdigest()==checkpoint['sha256']
 for attempt in result['attempts']:
  if attempt['progress']:
   v=json.loads((d/'search'/f"stage-{attempt['stage']}"/(attempt['name']+'.json')).read_text())
   assert v['nativeCopperChecks']==[True,True,True] and v['repair']['accepted']
report={'native_saves':183,'output_boards':78,'source_boards':26,'routed_boards':78,'ownership_mismatches_scored_corpus':0,'unsafe_axial_tracks_reassigned':3,'paired_minimal_checks':12,'paired_axial_checks':6,'unsafe_accepted_before':3,'unsafe_accepted_after':0,'controls_accepted_before':3,'controls_accepted_after':3,'axial_accepted_before':3,'axial_accepted_after':0,'unchanged_complete_repairs':6,'bounded_axial_proposals_refused':6,'router_rerun':False}
(root/'replay.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
