"""Independently replay captured native partitions, reports, and exact copper edits."""
import pathlib,json,hashlib,sys,importlib.util,collections,gzip
sys.dont_write_bytecode=True
R=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('p',R/'runtime-tools/native-thermal-proposals.py');p=importlib.util.module_from_spec(spec);sys.modules[spec.name]=p;spec.loader.exec_module(p)
def nodes(path):return p.parse(path.read_text())
def items(path):return {p.uid(n):n for n in nodes(path) if isinstance(n,list) and n[0] in ('segment','arc','via')}
def lost(before,after):
 m={x:i for i,g in enumerate(after) for x in g};return sum(m[a]!=m[b] for g in before for i,a in enumerate(g) for b in g[i+1:])
results=[]
for family in ('power','full'):
 d=R/family
 assert nodes(d/'input.kicad_pcb')==p.parse(gzip.decompress((R/'fixture/input.kicad_pcb.gz').read_bytes()).decode())
 for role in ('input','routed','candidate'):
  for ext in ('.kicad_pro','.kicad_dru'):assert (d/(role+ext)).read_bytes()==(R/'fixture'/('board'+ext)).read_bytes()
 before=items(d/'routed.kicad_pcb');after=items(d/'candidate.kicad_pcb');authored=items(d/'input.kicad_pcb');delta=json.loads((d/'delta.json').read_text());assert before.keys()==after.keys()
 changes=[u for u in before if before[u]!=after[u]];assert set(changes)==set(delta['modified']) and len(changes)==4
 assert sum(before[u][0]=='via' for u in changes)==1
 for u in authored:assert authored[u]==before[u]==after[u]
 for u in changes:
  expected=__import__('copy').deepcopy(before[u])
  for key in ('at','start','end'):
   point=p.child(expected,key)
   if point and list(map(float,point[1:3]))==[164.1045,50.6008]:point[1:3]=['163.804500','50.900800']
  assert expected==after[u]
 for repeat in range(3):
  for name in ('routed','candidate'):
   c=json.loads((d/f'{name}-{repeat}.json').read_text());candidate=(d/(name+'.kicad_pcb')).read_bytes();assert c['candidateSha256']==hashlib.sha256(candidate).hexdigest()
   assert c['inputSha256']==hashlib.sha256((d/'input.kicad_pcb').read_bytes()).hexdigest()
   assert c['repair']['routedSha256']==hashlib.sha256((d/'routed.kicad_pcb').read_bytes()).hexdigest()
   assert c['nativeCopperChecks']==[True]*3
   assert c['inputReport']['kicad_version']==c['candidateReport']['kicad_version']==c['repair']['routedReport']['kicad_version']=='10.0.6'
   assert c['inputReport']['ignored_checks']==c['candidateReport']['ignored_checks']==c['repair']['routedReport']['ignored_checks']
   assert c['opensAfter']==len(c['candidateReport']['unconnected_items'])
   assert c['lostTerminalPairs']==lost(c['terminalGroups']['input'],c['terminalGroups']['candidate'])
   assert c['repair']['lostTerminalPairs']==lost(c['repair']['terminalGroups']['input'],c['repair']['terminalGroups']['candidate'])
   errors=collections.Counter(e['type'] for e in c['candidateReport']['violations'] if e['severity']=='error');assert errors==collections.Counter(e['type'] for e in c['newErrors'])
   if family=='power':
    assert c['opensAfter']==95 and c['lostTerminalPairs']==c['repair']['lostTerminalPairs']==0
    assert errors==({} if name=='candidate' else {'starved_thermal':1})
    assert c['accepted']==(name=='candidate') and c['repair']['accepted']
   else:
    assert c['opensAfter']==(14 if name=='candidate' else 13)
    assert c['lostTerminalPairs']==(292 if name=='candidate' else 235)
    assert c['repair']['lostTerminalPairs']==(57 if name=='candidate' else 0)
    assert errors==({'starved_thermal':5,'clearance':3} if name=='candidate' else {'starved_thermal':6})
    assert not c['accepted'] and c['repair']['accepted']==(name=='routed')
    if name=='candidate':
     assert all(any(json.loads(t)[1]=='U1' and json.loads(t)[4]=='53' for t in pair) for pair in c['repair']['lostPairWitnesses'])
     ground=[g for g in c['terminalGroups']['candidate'] if json.loads(g[0])[0]=='GNDD']
     assert sorted(map(len,ground),reverse=True)==[57,3,1,1]
     assert any(len(g)==1 and json.loads(g[0])[1]=='U1' and json.loads(g[0])[4]=='53' for g in ground)
   results.append(dict(family=family,name=name,repeat=repeat,opens=c['opensAfter'],errors=dict(errors),lostSource=c['lostTerminalPairs'],lostCurrent=c['repair']['lostTerminalPairs'],accepted=c['accepted']))

from decimal import Decimal, InvalidOperation
def atom(n):
 if isinstance(n,list):return tuple(atom(x) for x in n)
 try:return Decimal(n).normalize()
 except InvalidOperation:return n
def inventory(board):
 names={'0':'""'}
 for n in board:
  if isinstance(n,list) and n[0]=='net' and len(n)==3:names[n[1]]=n[2]
 out=collections.Counter()
 for n in board:
  if not isinstance(n,list) or n[0] not in ('segment','via','arc'):continue
  net=p.child(n,'net');net=names.get(net[1],net[1]) if net else '""';fields=[]
  for v in n[1:]:
   if isinstance(v,list) and v[0] in ('start','end','mid','at','width','size','drill','layer','layers'):
    tag='endpoint' if n[0] in ('segment','arc') and v[0] in ('start','end') else v[0];fields.append((tag,atom(v[1:])))
  out[(n[0],net,tuple(sorted(fields,key=repr)))]+=1
 return out
sourceGroups=json.loads((R/'power/routed-0.json').read_text())['terminalGroups']['input'];discovery=[]
for filename in ('results.json','full-probe-results.json','joint-probe-results.json'):
 rows=json.loads((R/filename).read_text())
 assert len(rows)==(7 if filename.startswith('joint') else 12)
 for row in rows:
  out=R/row['name'];report=json.loads((out/'drc.json').read_text());groups=json.loads((out/'groups.json').read_text())
  assert row['opens']==len(report['unconnected_items'])
  assert row['errors']==[e['type'] for e in report['violations'] if e['severity']=='error']
  assert row['lostSource']==lost(sourceGroups,groups)
  submitted=inventory(nodes(out/'submitted.kicad_pcb'));native=inventory(nodes(out/'board.kicad_pcb'))
  physical=lambda items:collections.Counter({})+sum((collections.Counter({(kind,fields):count}) for (kind,net,fields),count in items.items()),collections.Counter())
  assert physical(submitted)==physical(native),(row['name'],physical(submitted)-physical(native),physical(native)-physical(submitted))
  ownership=submitted==native
  if not ownership:assert 'shorting_items' in row['errors']
  discovery.append(dict(name=row['name'],opens=row['opens'],errors=row['errors'],lostSource=row['lostSource'],exactPhysicalInventory=True,nativeNetInventoryMatches=ownership))
print(json.dumps(dict(decisions=results,discovery=discovery,exactFourItemMove=True,sourceCopperUnchanged=True),indent=2))
