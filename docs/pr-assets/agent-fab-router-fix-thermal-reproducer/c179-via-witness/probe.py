"""Compare an isolated generated via against intact original and full output."""
import argparse,json,sys,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
x.out.mkdir(exist_ok=False,parents=True)
m.native.SRC,m.native.D=x.source,x.out
assert m.native.pcbnew.Version()=='10.0.6'
source=x.source.read_bytes();original=x.input.read_bytes()
nodes=m.native.parse(source.decode());inp=m.native.parse(original.decode())
uid='d3812c01'
via=next(n for n in nodes if isinstance(n,list) and n[0]=='via' and m.native.uid(n).startswith(uid))
assert not any(isinstance(n,list) and m.native.uid(n)==m.native.uid(via) for n in inp)
variants={'original':original,'singleton':(m.native.dump(inp+[via])+'\n').encode(),'full':source,'removed':(m.native.dump([n for n in nodes if n is not via])+'\n').encode()}
for ext in ('.kicad_pro','.kicad_dru'):assert x.source.with_suffix(ext).read_bytes()==x.input.with_suffix(ext).read_bytes()
rows=[]
for repeat in range(3):
 for label,data in variants.items():
  (x.out/(label+'.kicad_pcb')).write_bytes(data)
  name=f'{label}-{repeat}'
  try:
   row=m.transaction.checked_native(data,name);failure=None
  except ValueError as exc:
   if label!='singleton' or str(exc)!='checked board differs from proposed design':raise
   row=None;failure=str(exc)
  rows.append(dict(label=label,repeat=repeat,row=row,failure=failure))
for r in rows:
 if r['row']:r['row'].pop('name')
assert len({json.dumps([(r['label'],r['row'],r['failure']) for r in rows if r['repeat']==i],sort_keys=True) for i in range(3)})==1
assert x.source.read_bytes()==source and x.input.read_bytes()==original
assert all(r['failure']=='checked board differs from proposed design' for r in rows if r['label']=='singleton')
assert all((len(r['row']['errors']),r['row']['opens'])=={'original':(0,110),'full':(6,15),'removed':(5,16)}[r['label']] for r in rows if r['label']!='singleton')
(x.out/'summary.json').write_text(json.dumps(dict(rows=rows,via=via,production_fix=False),indent=2)+'\n')
print('PASS: four configurations repeated identically; immutable sources')
