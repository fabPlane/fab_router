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
import gzip
fixture=root/'fixture'
full=sx.parse('(kicad_pcb '+gzip.decompress((fixture/'full-added.sexpr.gz').read_bytes()).decode()+')')[1:]
selected=sx.parse('(kicad_pcb '+(root/'minimized/selected.sexpr').read_text()+')')[1:]
net=lambda n:sx.child(n,'net')[1]
names=sorted({net(n) for n in selected})
assert names==['"+3V3"','"/Inputs/TCK"'] and len(selected)==74
for name in names:
 assert [n for n in selected if net(n)==name]==[n for n in full if net(n)==name]
rows=json.loads((root/'minimized/results.json').read_text())
baseline=json.loads((root/'minimized/source/groups.json').read_text())
source=sx.parse(gzip.decompress((fixture/'input.kicad_pcb.gz').read_bytes()).decode())
by_net={name:[n for n in full if net(n)==name] for name in {net(n) for n in full}}
for row in rows:
 d=root/'minimized'/row['name']
 report=json.loads((d/'drc.json').read_text());groups=json.loads((d/'groups.json').read_text())
 membership={v:i for i,g in enumerate(groups) for v in g}
 assert set(membership)=={v for g in baseline for v in g}
 lost=sum(membership[a]!=membership[b] for g in baseline for i,a in enumerate(g) for b in g[i+1:])
 assert lost==row['lost_pairs']
 assert len(report['unconnected_items'])==row['opens']
 assert [v['type'] for v in report['violations'] if v['severity']=='error']==row['errors']
 # Reconstruct the exact submitted physical copper independently of saved UUIDs.
 submitted=d/'submitted.kicad_pcb'
 submitted.write_text(sx.dump(source+[n for name in row['nets'] for n in by_net[name]])+'\n')
 assert inventory(submitted)==inventory(d/'board.kicad_pcb'),row['name']
 submitted.unlink()
assert rows[1]['added']==466 and rows[1]['lost_pairs']==348
for row in rows[-3:]:
 assert row['added']==74 and row['lost_pairs']==61 and row['opens']==94
 assert row['errors']==['starved_thermal']*2
for name in names:
 keep=[n for n in names if n!=name]
 assert any(r['nets']==keep and r['lost_pairs']==0 for r in rows)
checks=json.loads((root/'recheck-results.json').read_text());assert len(checks)==9
for row in checks:
 v=json.loads((root/'recheck'/f"{row['name']}-{row['repeat']}"/'result.json').read_text())
 assert v['nativeCopperPreserved'] and v['nativeCopperChecks']==[True,True]
 expected={'source':(0,110,0,True),'full':(6,15,348,False),'complete-net':(2,94,61,False)}[row['name']]
 assert (len(v['newErrors']),v['opensAfter'],v['lostTerminalPairs'],v['accepted'])==expected
 if row['name']=='complete-net':
  assert all(any(json.loads(identity)[1:2]==['U1'] and json.loads(identity)[4]=='53' for identity in pair) for pair in v['lostPairWitnesses'])
  assert {i['uuid'] for error in v['newErrors'] for i in error['items']}=={'cbaef996-a5ad-5073-a292-fe94da38fab6','12cbe2ed-3861-4e0e-89f1-6c66f25e5228','57ce983e-ec4e-48a5-9547-b23514d0d6a4'}
print(json.dumps(dict(discoveryChecks=len(rows),completeNets=names,retainedCopper=74,allNativeCopperInventoriesPreserved=True,repeatedGateChecks=9,productionFix=False,routerRerun=False),indent=2))
