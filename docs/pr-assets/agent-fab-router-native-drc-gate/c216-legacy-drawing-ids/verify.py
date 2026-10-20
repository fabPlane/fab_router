"""Replay native reports, exact physical ownership and proposal multiplicity."""
from pathlib import Path
from decimal import Decimal,InvalidOperation
import collections,gzip,sys,json,hashlib
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent));import sexpr as sx
r=Path(sys.argv[1])
def atom(n):
 if isinstance(n,list):return tuple(atom(v) for v in n)
 try:return Decimal(n)
 except InvalidOperation:return n
def inventory(board):
 names={'0':'""'}
 for n in board:
  if isinstance(n,list) and n[0]=='net' and len(n)==3:names[n[1]]=n[2]
 out=collections.Counter()
 for n in board:
  if not isinstance(n,list) or n[0] not in ['segment','arc','via']:continue
  field=sx.child(n,'net');net=names.get(field[1],field[1]) if field else '""';fields=[]
  for f in n[1:]:
   if isinstance(f,list) and f[0] in ['start','end','mid','at','width','size','drill','layer','layers']:
    tag='endpoint' if n[0] in ['segment','arc'] and f[0] in ['start','end'] else f[0];fields.append((tag,atom(f[1:])))
  out[(n[0],net,tuple(sorted(fields,key=repr)))]+=1
 return out
def pairs(groups):return {tuple(sorted((a,b))) for g in groups for i,a in enumerate(g) for b in g[i+1:]}
source=sx.parse(gzip.decompress((r/'fixture/input.kicad_pcb.gz').read_bytes()).decode());rows=[]
for filename in ['results.json','net-results.json','pair-results.json','min-results.json','reduce-results.json','detour-results.json']:
 for row in json.loads((r/filename).read_text()):
  out=r/row['name'];extra=sx.parse('(kicad_pcb '+(out/'added.sexpr').read_text()+')')[1:];saved=sx.parse((out/'board.kicad_pcb').read_text());rep=json.loads((out/'drc.json').read_text());errors=[v for v in rep['violations'] if v['severity']=='error']
  assert len(rep['unconnected_items'])==row['opens'];assert [e['type'] for e in errors]==row['errors']
  if 'has55' in row:assert row['has55']==any(i['uuid']=='57ce983e-ec4e-48a5-9547-b23514d0d6a4' for e in errors if e['type']=='starved_thermal' for i in e['items'])
  rows.append(dict(name=row['name'],items=len(extra),nativeInventoryMatches=inventory(source+extra)==inventory(saved),opens=row['opens'],errors=row['errors']))
minimal=sx.parse('(kicad_pcb '+(r/'minimal-added.sexpr').read_text()+')')[1:]
assert len(minimal)==1 and (r/'minimal-added.sexpr').read_bytes()==(r/'fixture/thermal55-added.sexpr').read_bytes()
assert inventory(source+minimal)==inventory(sx.parse((r/'reduce-014/board.kicad_pcb').read_text()))
strict=[]
for row in json.loads((r/'strict/results.json').read_text()):
 raw=json.loads((r/'strict'/f"{row['name']}-{row['repeat']}.json").read_text());candidate=row['name']=='candidate'
 assert raw['newErrors'] and len(raw['newErrors'])==1 if candidate else not raw['newErrors']
 assert raw['opensBefore']==110 and raw['opensAfter']==(111 if candidate else 110)
 assert raw['lostTerminalPairs']==0 and not pairs(raw['terminalGroups']['input'])-pairs(raw['terminalGroups']['candidate'])
 assert raw['nativeCopperChecks']==[True,True] and raw['accepted']==(not candidate)
 assert raw['inputReport']['kicad_version']==raw['candidateReport']['kicad_version']
 assert raw['inputReport']['ignored_checks']==raw['candidateReport']['ignored_checks']
 if candidate:assert any(i['uuid']=='57ce983e-ec4e-48a5-9547-b23514d0d6a4' for i in raw['newErrors'][0]['items'])
 strict.append(row)
assert len(strict)==6
# All three after manifests and all candidate bytes must agree. Each exact
# legacy drawing survives unchanged, including its duplicate UUID.
original=sx.parse((r/'search-inputs/routed.kicad_pcb').read_text());drawings=[n for n in original if isinstance(n,list) and n[0].startswith('gr_')]
assert any(count==3 for count in collections.Counter(sx.uid(n) for n in drawings).values())
generator=json.loads((r/'generator-results.json').read_text());assert len(generator)==6
for row in generator:
 assert row['exit']==(1 if row['version']=='before' else 0)
 assert row['proposals']==(0 if row['version']=='before' else 158)
 if row['version']=='before':assert 'Ambiguous native item identities' in (r/f"generator-before-{row['repeat']}.log").read_text()
base=r/'generator-after-0';manifest=(base/'manifest.json').read_bytes();entries=json.loads(manifest)
for row in generator[3:]:
 out=r/f"generator-after-{row['repeat']}";assert (out/'manifest.json').read_bytes()==manifest
 for entry in entries:
  data=(out/entry['name']).read_bytes();assert data==(base/entry['name']).read_bytes()
  if row['repeat']==0:
   nodes=sx.parse(data.decode());assert [n for n in nodes if isinstance(n,list) and n[0].startswith('gr_')]==drawings
   assert not inventory(source)-inventory(nodes)
# Search callers and frozen inputs retain the exact original bytes and rules.
for role in ['input','routed']:
 for ext in ['.kicad_pcb','.kicad_pro','.kicad_dru']:
  data=(r/'search-inputs'/(role+ext)).read_bytes()
  for phase in ['search','search-after']:
   assert (r/phase/role/('board'+ext)).read_bytes()==data
assert (r/'search-inputs/input.kicad_pcb').read_bytes()==gzip.decompress((r/'fixture/input.kicad_pcb.gz').read_bytes())
assert 'Ambiguous native item identities' in (r/'search.log').read_text()
old=json.loads((r/'search/baseline.json').read_text());new=json.loads((r/'search-after/baseline.json').read_text())
for baseline in [old,new]:
 assert len(baseline['newErrors'])==2 and baseline['lostTerminalPairs']==0 and baseline['opensAfter']==95 and baseline['nativeCopperChecks']==[True,True,True]
search=None
if (r/'search-after/result.json').exists():
 result=json.loads((r/'search-after/result.json').read_text());attempts=result['attempts'];progress=[]
 for attempt in attempts:
  directory=r/f"search-after/stage-{attempt['stage']}";manifest=json.loads((directory/'manifest.json').read_text());entry=next(v for v in manifest if v['name']==attempt['name']);assert entry['label']==attempt['label']
  before=json.loads((r/f"search-after/stage-{attempt['stage']}.json").read_text());check=json.loads((directory/(attempt['name']+'.json')).read_text())
  errors=lambda report:sum(v['severity']=='error' for v in report['violations'])
  expected=check['opensAfter']<=check['opensBefore'] and check['lostTerminalPairs']==0 and check['repair']['accepted'] and all(v['type']=='starved_thermal' for v in check['newErrors']) and len(check['newErrors'])<len(before['newErrors']) and errors(check['candidateReport'])<errors(check['repair']['routedReport'])
  assert expected==attempt['progress']
  if attempt['progress']:
   assert check['nativeCopperChecks']==[True,True,True] and check['repair']['lostTerminalPairs']==0
   progress.append(dict(stage=attempt['stage'],name=attempt['name'],errors=len(check['newErrors']),opens=check['opensAfter']))
 for stage in range(result['stages']):
  entries=[a for a in attempts if a['stage']==stage];assert [a['name'] for a in entries]==[f'{i:03}.kicad_pcb' for i in range(len(entries))]
  assert not any(a['progress'] for a in entries[:-1])
 validation=result['validation'];assert validation['nativeCopperChecks']==[True,True,True] and validation['lostTerminalPairs']==0 and validation['repair']['lostTerminalPairs']==0
 assert validation['opensAfter']==95
 if result['published']:
  import base64
  bundle=json.loads((r/'accepted-after.json').read_text());assert validation['accepted'] and not validation['newErrors']
  for role in ['input','routed','candidate']:
   for member in bundle[role]:assert hashlib.sha256(base64.b64decode(member['base64'])).hexdigest()==member['sha256']
  for role in ['input','routed']:
   for member in bundle[role]:assert base64.b64decode(member['base64'])==(r/'search-inputs'/(role+Path(member['name']).suffix)).read_bytes()
  assert bundle['validation']['accepted'] and not bundle['validation']['newErrors'] and bundle['validation']['lostTerminalPairs']==bundle['validation']['repair']['lostTerminalPairs']==0
 else:assert not (r/'accepted-after.json').exists()
 for entry in json.loads((r/'search-after/stage-0/manifest.json').read_text()):
  assert (r/'search-after/stage-0'/entry['name']).read_bytes()==(base/entry['name']).read_bytes()
 search=dict(published=result['published'],repaired=result['repaired'],attempts=len(attempts),stages=result['stages'],errors=len(validation['newErrors']),opens=validation['opensAfter'],progress=progress)
fullport=[]
for row in json.loads((r/'full-port/results.json').read_text()):
 raw=json.loads((r/'full-port'/f"{row['name']}-{row['repeat']}.json").read_text());candidate=row['name']=='candidate'
 assert len(raw['newErrors'])==(6 if candidate else 7) and all(e['type']=='starved_thermal' for e in raw['newErrors'])
 assert raw['nativeCopperChecks']==[True,True,True] and raw['lostTerminalPairs']==235 and raw['opensAfter']==13
 assert raw['repair']['lostTerminalPairs']==0 and raw['repair']['accepted'] and not raw['repair']['newErrors'] and not raw['accepted']
 assert len(pairs(raw['terminalGroups']['input'])-pairs(raw['terminalGroups']['candidate']))==235
 assert not pairs(raw['repair']['terminalGroups']['input'])-pairs(raw['repair']['terminalGroups']['candidate'])
 pads={i['uuid'] for e in raw['newErrors'] for i in e['items']}
 assert ('12cbe2ed-3861-4e0e-89f1-6c66f25e5228' in pads)==(not candidate)
 assert '57ce983e-ec4e-48a5-9547-b23514d0d6a4' in pads
 fullport.append(row)
assert len(fullport)==6
initial=json.loads((r/'full-port/check.json').read_text());assert len(initial['newErrors'])==6 and initial['opensAfter']==13 and initial['lostTerminalPairs']==235 and initial['repair']['lostTerminalPairs']==0 and initial['nativeCopperChecks']==[True,True,True] and not initial['accepted']
for name,digest in json.loads((r/'fixture-hashes.json').read_text()).items():assert hashlib.sha256((r/'fixture'/name).read_bytes()).hexdigest()==digest
old=sx.parse((r/'full-port/routed.kicad_pcb').read_text());new=sx.parse((r/'full-port/candidate.kicad_pcb').read_text())
assert sum((inventory(old)-inventory(new)).values())==1 and sum((inventory(new)-inventory(old)).values())==3
assert not inventory(source)-inventory(old) and not inventory(source)-inventory(new)
for role in ['input','routed','candidate']:
 for ext in ['.kicad_pro','.kicad_dru']:assert (r/'full-port'/(role+ext)).read_bytes()==(r/'fixture'/('board'+ext)).read_bytes()
for name,digest in json.loads((r/'source-hashes.json').read_text()).items():assert hashlib.sha256((r/'measured-source'/name).read_bytes()).hexdigest()==digest
result=dict(nativeDiscovery=rows,strict=strict,generator=generator,search=search,fullPort=fullport,minimalAddedItems=1,allChecksPassed=True)
print(json.dumps(result,indent=2))
