"""Independent evidence replay, including rejected candidates and terminal partitions."""
import base64,hashlib,json,pathlib,sys,collections
root=pathlib.Path(sys.argv[1]);rows=[]
def load(p):return json.loads(p.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pairs(report):
 groups=report['terminalGroups'];a,b=groups['input'],groups['candidate'];membership={pad:i for i,g in enumerate(b) for pad in g}
 assert len(membership)==sum(map(len,b))
 assert all(pad in membership for g in a for pad in g)
 lost=sum(membership.get(x)!=membership.get(y) for g in a for i,x in enumerate(g) for y in g[i+1:])
 assert lost==report['lostTerminalPairs'];return lost
for work in sorted(root.glob('search-*')):
 if not work.is_dir():continue
 repeat=int(work.name.split('-')[-1]);result=load(work/'result.json');baseline=load(work/'baseline.json');checked=list(work.glob('stage-*/*.kicad_pcb.json'))
 assert len(checked)==len(result['attempts']);pairs(baseline);pairs(baseline['repair'])
 reasons=collections.Counter();progress=[]
 for s in work.glob('stage-*/manifest.json'):
  manifest=load(s);assert len(manifest)<=304
  assert {f.name for f in s.parent.glob('*.kicad_pcb')}=={r['name'] for r in manifest}
 for attempt in result['attempts']:
  d=work/f"stage-{attempt['stage']}";c=d/attempt['name'];r=load(pathlib.Path(str(c)+'.json'))
  assert r['candidateSha256']==digest(c);pairs(r);pairs(r['repair'])
  for e in r['newErrors']:reasons[e['type']]+=1
  if r['lostTerminalPairs']:reasons['source_pair_loss']+=1
  if r['repair']['lostTerminalPairs']:reasons['routed_pair_loss']+=1
  if r['opensAfter']>r['opensBefore']:reasons['source_open_increase']+=1
  if r['repair']['opensAfter']>r['repair']['opensBefore']:reasons['routed_open_increase']+=1
  if attempt['progress']:
   assert not r['lostTerminalPairs'] and r['repair']['accepted'] and r['opensAfter']<=r['opensBefore']
   assert all(e['type']=='starved_thermal' for e in r['newErrors'])
   errors=lambda report:sum(v['severity']=='error' for v in report['violations'])
   assert errors(r['candidateReport'])<errors(r['repair']['routedReport']);progress.append(attempt)
 v=result['validation'];pairs(v);pairs(v['repair'])
 assert v['inputSha256']==digest(root/'fixtures/source.kicad_pcb')
 assert v['repair']['routedSha256']==digest(root/'fixtures/routed.kicad_pcb')
 bundle=root/f'accepted-{repeat}.json';assert bundle.exists()==result['published']
 if result['published']:
  assert v['accepted'] and not v['newErrors']
  b=load(bundle);assert b['format']=='fab-router-native-repair-v1'
  for role in ['input','routed','candidate']:
   for item in b[role]:assert hashlib.sha256(base64.b64decode(item['base64'],validate=True)).hexdigest()==item['sha256']
  assert next(i['sha256'] for i in b['candidate'] if i['name']=='board.kicad_pcb')==v['candidateSha256']
 row=dict(repeat=repeat,published=result['published'],before_errors=len(baseline['newErrors']),after_errors=len(v['newErrors']),opens=v['opensAfter'],lost_source_pairs=v['lostTerminalPairs'],lost_routed_pairs=v['repair']['lostTerminalPairs'],stages=result['stages'],attempts=len(checked),progress=len(progress),native_checks=3*len(checked)+6+3*int(result['published']),candidate_sha256=v['candidateSha256'],finding_totals=dict(reasons))
 rows.append(row)
assert len(rows)==3
assert len({r["candidate_sha256"] for r in rows})==1
assert all(r["before_errors"]==1 and r["after_errors"]==0 and r["published"] and r["opens"]==r["lost_source_pairs"]==r["lost_routed_pairs"]==0 for r in rows)
for work in root.glob("search-*"):
 if work.is_dir():
  for role,name in [("input","source"),("routed","routed")]:
   for ext in [".kicad_pcb",".kicad_pro",".kicad_dru"]:assert (work/role/("board"+ext)).read_bytes()==(root/"fixtures"/(name+ext)).read_bytes()
print(json.dumps(rows,indent=2))
