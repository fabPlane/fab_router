import pathlib,subprocess,json,sys,shutil,importlib.util,collections,decimal
root=pathlib.Path(sys.argv[1]);d=root/'native'
spec=importlib.util.spec_from_file_location('sx',root/'before-proposals.py');sx=importlib.util.module_from_spec(spec);sys.modules[spec.name]=sx;spec.loader.exec_module(sx)
def atom(x):
 if x.startswith('"'):return x
 try:return str(decimal.Decimal(x).normalize())
 except decimal.InvalidOperation:return x
def inv(p):
 b=sx.parse(p.read_text());nets={'0':'""'}
 for n in b:
  if isinstance(n,list) and n[0]=='net':nets[n[1]]=n[2]
 items=[]
 for n in b:
  if not isinstance(n,list) or n[0] not in ('segment','arc','via'):continue
  net=sx.child(n,'net');net=net[1]if net else '""'
  if not net.startswith('"'):net=nets[net]
  fields=[]
  for f in n[1:]:
   if not isinstance(f,list) or f[0] not in ('start','end','mid','at','width','size','drill','layer','layers'):continue
   tag='endpoint'if n[0] in ('segment','arc') and f[0] in ('start','end')else f[0]
   fields.append((tag,*map(atom,f[1:])))
  items.append(repr((n[0],net,sorted(fields))))
 return collections.Counter(items)

rows=[]
for role in ('input','routed','candidate'):
 before=inv(root/'paired'/(role+'.kicad_pcb'));after=inv(d/(role+'.kicad_pcb'));assert before==after,role
 report=json.loads((d/(role+'.json')).read_text());rows.append(dict(role=role,inventoryMatches=True,items=sum(before.values()),errors=[e['type']for e in report['violations']if e['severity']=='error'],opens=len(report['unconnected_items'])))
a=inv(root/'paired/routed.kicad_pcb');b=inv(root/'paired/candidate.kicad_pcb');assert sum((a-b).values())==1 and sum((b-a).values())==3
result={'rows':rows,'removed':list((a-b).elements()),'added':list((b-a).elements())}
assert result==json.loads((root/'native-summary.json').read_text())
paired=json.loads((root/'paired-summary.json').read_text());assert len(paired)==6
for row in paired:
 d=json.loads((root/'paired'/f"{row['label']}-{row['repeat']}.json").read_text())
 assert d['accepted']==row['accepted']==(row['label']=='after')
 assert d['opensAfter']==row['opens']==109 and d['lostTerminalPairs']==row['lostSource']==0
 assert d['repair']['lostTerminalPairs']==row['lostRouted']==0
 assert d['nativeCopperChecks']==row['owned']==[True,True,True]
 assert [e['type']for e in d['newErrors']]==row['errors']==([]if row['label']=='after'else ['starved_thermal'])
print(json.dumps(result,indent=2))
