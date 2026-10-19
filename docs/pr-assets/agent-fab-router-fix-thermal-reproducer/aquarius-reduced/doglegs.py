#!/usr/bin/python3
"""Static full-board experiment: preserve original segment ends with short links."""
import argparse, copy, hashlib, json, math, uuid
from pathlib import Path
import native
HERE=Path(__file__).resolve().parent
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args(); a.out.mkdir(parents=True,exist_ok=False)
native.SRC=a.source; native.D=a.out
assert native.pcbnew.Version()=='10.0.6'
base=native.parse(a.source.read_text())
fixture=native.parse((HERE/'board.kicad_pcb').read_text())
tracks=[n for n in fixture if isinstance(n,list) and n[0]=='segment']
inputs={str(f):sha(f) for f in [a.source,a.source.with_suffix('.kicad_pro'),a.source.with_suffix('.kicad_dru')]}
rows=[]
for repeat in range(1,4):
 for index in (None,1,2):
  nodes=copy.deepcopy(base); added=[]
  if index is not None:
   original=next(n for n in base if isinstance(n,list) and native.uid(n)==native.uid(tracks[index]))
   track=next(n for n in nodes if isinstance(n,list) and native.uid(n)==native.uid(original))
   angle=math.radians(-315); c,s=math.cos(angle),math.sin(angle)
   vector=(c,s) if index==1 else (-s,c)
   delta=tuple(round(v*100000) for v in vector)
   for key in ('start','end'):
    before=native.child(original,key); after=native.child(track,key)
    for axis in (0,1):after[axis+1]=f'{float(before[axis+1])+delta[axis]/1e6:.6f}'
    link=copy.deepcopy(original)
    native.child(link,'start')[1:]=before[1:]
    native.child(link,'end')[1:]=after[1:]
    native.child(link,'uuid')[1]='"'+str(uuid.uuid5(uuid.NAMESPACE_URL,f'thermal-dogleg-{index}-{key}'))+'"'
    nodes.append(link);added.append(link)
   # Original endpoints survive exactly, with unchanged width/layer/net.
   for link in added:
    for key in ('width','layer','net'):assert native.child(link,key)==native.child(original,key)
   restored=copy.deepcopy(nodes[:-2]);restored[nodes.index(track)]=copy.deepcopy(original)
   assert restored==base
  row=native.check(nodes,f'{"baseline" if index is None else "track-"+str(index+1)}-{repeat}')
  directory=a.out/row['name']
  row.update(track_index=None if index is None else index+1, endpoint_links=len(added),
   sha256={f.name:sha(f) for f in directory.iterdir() if f.is_file() and f.suffix!='.kicad_prl'})
  rows.append(row)
for index in (None,2,3):
 group=[r for r in rows if r['track_index']==index]
 assert len(group)==3
 for field in ('counts','errors','target','opens'):assert all(r[field]==group[0][field] for r in group)
baseline=rows[0]
for row in rows:
 expected=[e for e in baseline['errors'] if e not in baseline['target']] if row['track_index']==2 else baseline['errors']
 assert row['errors']==expected
 assert row['opens']==baseline['opens']==15
assert inputs=={name:sha(Path(name)) for name in inputs}
(a.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,native_version=native.pcbnew.Version(),repeats=3,input_sha256=inputs,script_sha256=sha(Path(__file__)),rows=rows),indent=2)+'\n')
