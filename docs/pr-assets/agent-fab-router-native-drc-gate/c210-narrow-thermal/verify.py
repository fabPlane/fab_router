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
rows=json.loads((root/'summary.json').read_text())+json.loads((root/'narrow-summary.json').read_text())
assert len(rows)==18 and len({r['label'] for r in rows})==18
for row in rows:
 report=json.loads((root/row['label']/'report.json').read_text())
 assert report['accepted']==row['accepted']==False
 assert [x['type'] for x in report['newErrors']]==row['errors']
 assert report['opensAfter']==row['opens'] and report['lostTerminalPairs']==row['lost']==0
 assert report['nativeCopperChecks']==row['nativeCopperChecks']
 assert report['repair']['lostTerminalPairs']==0
selected=json.loads((root/'r0.06-s1/report.json').read_text())
assert selected['newErrors']==[] and selected['opensBefore']==110 and selected['opensAfter']==111
assert selected['nativeCopperChecks']==[True,True,True] and selected['repair']['accepted']
def net_opens(report):
 return [v for v in report['unconnected_items'] if any('Net-(C1-Pad1)' in i['description'] for i in v['items'])]
assert len(net_opens(selected['inputReport']))==2 and len(net_opens(selected['candidateReport']))==3
track_gaps=[v for v in net_opens(selected['candidateReport']) if any('Track [' in i['description'] for i in v['items'])]
assert len(track_gaps)==2
assert {i['uuid'] for v in track_gaps for i in v['items'] if i['description'].startswith('Pad ')}=={'9ed9deec-e5aa-43e2-8257-ea9e272f0724','57fc0998-f718-44aa-b0a8-fc7c1a5c2d1f'}
assert inventory(root/'r0.06-s1/board.kicad_pcb')==inventory(root/'native/board.kicad_pcb')
r=json.loads((root/'native/drc.json').read_text());assert r['kicad_version']=='10.0.6'
assert not any(v['severity']=='error' for v in r['violations']) and len(r['unconnected_items'])==111
rechecks=json.loads((root/'recheck-summary.json').read_text());assert len(rechecks)==3
for row in rechecks:
 assert not row['accepted'] and row['errors']==[] and row['opens']==111 and row['lost']==0 and row['nativeCopperChecks']==[True,True,True]
import base64,hashlib
for repeat in range(3):
 for label in ['before','after']:
  name=label+'.json' if repeat==0 else f'{label}-{repeat}.json'
  v=json.loads((root/'backbone'/name).read_text())
  assert v['newErrors']==[] if label=='after' else [e['type'] for e in v['newErrors']]==['starved_thermal']
  assert v['opensBefore']==110 and v['opensAfter']==109 and v['lostTerminalPairs']==v['repair']['lostTerminalPairs']==0
  assert v['nativeCopperChecks']==[True,True,True] and v['repair']['accepted']
  assert v['accepted']==(label=='after')
old=inventory(root/'backbone/routed.kicad_pcb');new=inventory(root/'backbone/candidate.kicad_pcb')
assert sum((old-new).values())==1 and sum((new-old).values())==3
assert all('Net-(C1-Pad1)' in key for key in list(old-new)+list(new-old))
bundle=json.loads((root/'backbone/accepted.json').read_text())
assert bundle['validation']['accepted'] and bundle['validation']['nativeCopperChecks']==[True,True,True]
assert base64.b64decode(bundle['candidate'][0]['base64'])==(root/'backbone/candidate.kicad_pcb').read_bytes()
print(json.dumps({'probes':len(rows),'acceptedProbeCount':0,'cleanOwnedProbes':[r['label'] for r in rows if not r['errors'] and all(r['nativeCopperChecks'])],'isolatedRepeatChecks':3,'isolatedNativeCopperExact':True,'backbonePairedRepeats':3,'backboneCandidateAccepted':True,'backboneExactBundle':True},indent=2))
