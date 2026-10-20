from pathlib import Path
import json,sys,base64,hashlib
r=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent

def check_pairs(v):
 for groups, claimed in [(v['terminalGroups'],v['lostTerminalPairs']),
                         (v['repair']['terminalGroups'],v['repair']['lostTerminalPairs'])]:
  assert groups['nativeVersion']=='10.0.6'
  member={t:i for i,g in enumerate(groups['candidate']) for t in g}
  original={t for g in groups['input'] for t in g}
  assert original==set(member)
  lost=sum(a not in member or b not in member or member[a]!=member[b]
           for g in groups['input'] for i,a in enumerate(g) for b in g[i+1:])
  assert lost==claimed
 assert v['opensBefore']==len(v['inputReport']['unconnected_items'])
 assert v['opensAfter']==len(v['candidateReport']['unconnected_items'])
 assert v['repair']['opensBefore']==len(v['repair']['routedReport']['unconnected_items'])

result=json.loads((r/'search/result.json').read_text());bundle=json.loads((r/'accepted.json').read_text())
assert result['repaired'] and result['published'] and result['stages']==1
assert len(result['attempts'])==169
assert result['attempts'][-1]['label']==['via','e57c15b7-d609-442a-9cca-2c520d20bbab']
assert [i['progress'] for i in result['attempts']]==[False]*168+[True]
v=result['validation'];check_pairs(v);assert v['accepted'] and not v['newErrors'] and v['lostTerminalPairs']==v['repair']['lostTerminalPairs']==0 and v['opensAfter']==95
for role in ['input','routed','candidate']:
 for f in bundle[role]:assert hashlib.sha256(base64.b64decode(f['base64'])).hexdigest()==f['sha256']
assert bundle['validation']['accepted'] and not bundle['validation']['newErrors']
selected=r/'search'/'stage-0'/result['attempts'][-1]['name']
assert base64.b64decode(bundle['candidate'][0]['base64'])==selected.read_bytes()
measurement=json.loads((r/'measurement.json').read_text())
for item in measurement:
 assert selected.read_bytes()==(r/'native'/f"after-{item['repeat']}"/item['proposal']['name']).read_bytes()
for role in ['input','routed']:
 assert base64.b64decode(bundle[role][0]['base64'])==(r/'native'/(role+'.kicad_pcb')).read_bytes()
for role in ['input','routed']:
 for ext in ['.kicad_pcb','.kicad_pro','.kicad_dru']:assert (r/'native'/(role+ext)).read_bytes()==(r/'search'/role/('board'+ext)).read_bytes()
for attempt in result['attempts']:
 v=json.loads((r/'search'/f"stage-{attempt['stage']}"/(attempt['name']+'.json')).read_text())
 check_pairs(v)
 submitted=r/'search'/f"stage-{attempt['stage']}"/attempt['name']
 assert v['candidateSha256']==hashlib.sha256(submitted.read_bytes()).hexdigest()
 assert v['inputSha256']==hashlib.sha256((r/'native/input.kicad_pcb').read_bytes()).hexdigest()
 assert v['repair']['routedSha256']==hashlib.sha256((r/'native/routed.kicad_pcb').read_bytes()).hexdigest()
 repair=v.get('repair') or {}
 progress=(v['opensAfter']<=v['opensBefore'] and v['lostTerminalPairs']==0
           and repair.get('accepted') is True
           and all(e['type']=='starved_thermal' for e in v['newErrors'])
           and len(v['newErrors'])<1
           and sum(e['severity']=='error' for e in v['candidateReport']['violations'])
             <sum(e['severity']=='error' for e in repair['routedReport']['violations']))
 assert progress==attempt['progress']
 if progress:assert v['accepted'] and not v['newErrors'] and v['lostTerminalPairs']==repair['lostTerminalPairs']==0
print(json.dumps(dict(repaired=True,published=True,stages=1,attempts=169,priorRejected=168,selected=result['attempts'][-1],opens=95,sourceAndCurrentPairsPreserved=True,callerUnchanged=True),indent=2))
