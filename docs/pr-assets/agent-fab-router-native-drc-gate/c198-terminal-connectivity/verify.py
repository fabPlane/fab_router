"""Replay captured native decisions, partitions, input bindings and bundle bytes."""
import argparse,base64,collections,hashlib,itertools,json,pathlib
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);x=p.parse_args();root=x.root
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(p.read_text())
def signature(report):
 return collections.Counter(json.dumps([v['type'],v['severity'],sorted((i['description'],i['pos']['x'],i['pos']['y']) for i in v['items'])],sort_keys=True) for v in report['violations'] if v['severity']=='error')
def verify(d):
 before,after=load(d/'before.json'),load(d/'after.json')
 for r in [before,after]:
  assert sha((d/'input/board.kicad_pcb').read_bytes())==r['inputSha256']
  assert sha((d/'candidate/board.kicad_pcb').read_bytes())==r['candidateSha256']
  a,b=r['inputReport'],r['candidateReport']
  errors=sum((signature(b)-signature(a)).values())
  assert errors==len(r['newErrors']) and r['opensBefore']==len(a['unconnected_items']) and r['opensAfter']==len(b['unconnected_items'])
  assert a['kicad_version']==b['kicad_version'];assert a['ignored_checks']==b['ignored_checks']
  if r is before: assert r['accepted']==(errors==0 and r['opensAfter']<=r['opensBefore'])
 g=after['terminalGroups'];assert g['nativeVersion']==after['inputReport']['kicad_version']
 def membership(groups):
  result={}
  for index,members in enumerate(groups):
   assert members
   for member in members:assert member not in result;result[member]=index
  return result
 a,b=membership(g['input']),membership(g['candidate']);assert a.keys()==b.keys()
 # Independent combinatorial calculation rather than the gate's pair loop.
 lost=0
 for group in g['input']:
  buckets=collections.Counter(b[member] for member in group)
  lost+=len(group)*(len(group)-1)//2-sum(n*(n-1)//2 for n in buckets.values())
 assert lost==after['lostTerminalPairs']
 witnesses=after['lostPairWitnesses'];assert len(witnesses)==min(lost,32)
 assert all(a[left]==a[right] and b[left]!=b[right] for left,right in witnesses)
 assert after['accepted']==(len(after['newErrors'])==0 and after['opensAfter']<=after['opensBefore'] and lost==0)
 assert after['published']==after['accepted']==(d/'bundle.json').exists()
 if after['published']:
  bundle=load(d/'bundle.json');assert bundle['format']=='fab-router-native-candidate-v1'
  assert bundle['validation']=={k:v for k,v in after.items() if k!='published'}
  for role in ['input','candidate']:
   assert {f['name'] for f in bundle[role]}=={f.name for f in (d/role).iterdir()}
   for f in bundle[role]:
    data=base64.b64decode(f['base64'],validate=True);assert sha(data)==f['sha256'];assert data==(d/role/f['name']).read_bytes()
 return lost
rows=load(root/'native/results.json');assert len(rows)==78
for r in rows:assert verify(root/'native'/r['directory'])==r['lost_terminal_pairs']
controls=load(root/'controls-final/results.json');assert len(controls)==12
for r in controls:assert verify(root/'controls-final'/r['directory'])==r['lost_terminal_pairs']
for d in ['rewired','actual']:
 directory=root/'audit-final'/d
 a,b=[load(directory/role/'groups.json') for role in ['input','candidate']]
 losses=sorted([x,y] for x in a for y in a[x] if x<y and y not in b[x]);s=load(directory/'summary.json');assert losses==s['lost_pairs'];assert len(losses)==s['lost_terminal_pairs']
print('PASS: 78 paired benchmark outputs, 12 repeated controls, exact bundles, and independent native pad audit')
