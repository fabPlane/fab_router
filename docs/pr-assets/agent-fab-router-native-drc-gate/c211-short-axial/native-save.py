import pathlib,subprocess,json,sys,shutil,importlib.util,collections,decimal
root=pathlib.Path(sys.argv[1]);d=root/'native';d.mkdir()
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
 for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru'):shutil.copyfile(root/'paired'/(role+ext),d/(role+ext))
 cmd=['kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(d/(role+'.json')),str(d/(role+'.kicad_pcb'))]
 p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120);(d/(role+'.log')).write_text(p.stdout);assert p.returncode==0
 before=inv(root/'paired'/(role+'.kicad_pcb'));after=inv(d/(role+'.kicad_pcb'));assert before==after,role
 report=json.loads((d/(role+'.json')).read_text());rows.append(dict(role=role,inventoryMatches=True,items=sum(before.values()),errors=[e['type']for e in report['violations']if e['severity']=='error'],opens=len(report['unconnected_items'])))
a=inv(root/'paired/routed.kicad_pcb');b=inv(root/'paired/candidate.kicad_pcb');assert sum((a-b).values())==1 and sum((b-a).values())==3
(root/'native-summary.json').write_text(json.dumps({'rows':rows,'removed':list((a-b).elements()),'added':list((b-a).elements())},indent=2)+'\n');print(json.dumps(rows))
