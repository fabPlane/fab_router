"""Independent exact Decimal physical copper and semantic net inventory replay."""
import sys,pathlib,collections,json
from decimal import Decimal,InvalidOperation
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent));import sexpr as sx
r=pathlib.Path(sys.argv[1])
def inventory(path):
 board=sx.parse(path.read_text());names={'0':'""'}
 for n in board:
  if isinstance(n,list) and n[0]=='net' and len(n)==3:names[n[1]]=n[2]
 def atom(value):
  if isinstance(value,list):return tuple(atom(v) for v in value)
  try:return Decimal(value)
  except InvalidOperation:return value
 result=collections.Counter()
 for n in board:
  if not isinstance(n,list) or n[0] not in ['segment','arc','via']:continue
  nf=sx.child(n,'net');net=nf[1] if nf else '""';net=names.get(net,net)
  assert net.startswith('"'),net
  geometry=[]
  for field in n[1:]:
   if isinstance(field,list) and field[0] in ['start','end','mid','at','width','size','drill','layer','layers']:
    tag='endpoint' if n[0] in ['segment','arc'] and field[0] in ['start','end'] else field[0]
    geometry.append((tag,tuple(atom(v) for v in field[1:])))
  result[(n[0],net,tuple(sorted(geometry,key=repr)))]+=1
 return result

import gzip
source=sx.parse(gzip.decompress((r/'fixture/input.kicad_pcb.gz').read_bytes()).decode())
full=sx.parse('(kicad_pcb '+gzip.decompress((r/'fixture/full-added.sexpr.gz').read_bytes()).decode()+')')[1:]
source_groups=json.loads((r/'source-groups.json').read_text())
def pairs(groups):return {tuple(sorted((a,b))) for g in groups for i,a in enumerate(g) for b in g[i+1:]}
def normalized(n):
 if isinstance(n,list):return tuple(normalized(v) for v in n)
 try:return Decimal(n)
 except InvalidOperation:return n
basepairs=pairs(source_groups); rows=[]
for row in json.loads((r/'results.json').read_text()):
 name=row['name'];out=r/name;extras=sx.parse('(kicad_pcb '+(out/'added.sexpr').read_text()+')')[1:]
 assert len(extras)==len(full)==466
 original={sx.uid(n):n for n in full};modified=[sx.uid(n) for n in extras if normalized(n)!=normalized(original[sx.uid(n)])]
 assert modified==row['modified']
 # Compare submitted exact geometry/net inventory with independently saved native board.
 submitted=r/'submitted.kicad_pcb';submitted.write_text(sx.dump(source+extras)+'\n')
 assert inventory(submitted)==inventory(out/'board.kicad_pcb'),name
 groups=json.loads((out/'groups.json').read_text());assert len(basepairs-pairs(groups))==row['lost_pairs']
 report=json.loads((out/'drc.json').read_text());assert len(report['unconnected_items'])==row['opens']
 assert [v['type'] for v in report['violations'] if v['severity']=='error']==row['errors']
 rows.append(dict(name=name,exactPhysicalCopperAndOwnership=True,lostSourcePairs=row['lost_pairs']))
submitted.unlink()
assert inventory(r/'strict/routed.kicad_pcb')==inventory(r/'before/board.kicad_pcb')
assert inventory(r/'strict/candidate.kicad_pcb')==inventory(r/'joint--0.12/board.kicad_pcb')
assert not inventory(r/'strict/input.kicad_pcb')-inventory(r/'strict/candidate.kicad_pcb')
strict=json.loads((r/'strict/results.json').read_text());assert len(strict)==6
for row in strict:
 raw=json.loads((r/'strict'/f"{row['name']}-{row['repeat']}.json").read_text())
 assert raw['nativeCopperChecks']==[True,True,True] and raw['accepted']==False
 assert raw['repair']['accepted'] and raw['repair']['lostTerminalPairs']==0
 assert raw['newErrors'] and all(e['type']=='starved_thermal' for e in raw['newErrors']) and len(raw['newErrors'])==6
 assert raw['lostTerminalPairs']==(348 if row['name']=='routed' else 292)
 assert raw['opensAfter']==(15 if row['name']=='routed' else 14)
print(json.dumps(dict(discovery=rows,strictDecisions=6,allChecksPassed=True),indent=2))
