"""Reproduce the spatial crop and deletion search from a completed native output."""
import argparse
import native
from native import *
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',required=True,type=Path)
p.add_argument('--out',required=True,type=Path)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
D=a.out;SRC=a.source;native.D=D;native.SRC=SRC
b=pcbnew.LoadBoard(str(SRC))
pad=next(p for p in b.GetPads() if p.m_Uuid.AsString()==TARGET)
pos=pad.GetPosition();rad=2
keep=set()
for item in list(b.GetTracks())+list(b.GetFootprints()):
 box=item.GetBoundingBox();x,y=box.GetPosition().x,box.GetPosition().y
 if x<=pos.x+rad*1e6 and x+box.GetWidth()>=pos.x-rad*1e6 and y<=pos.y+rad*1e6 and y+box.GetHeight()>=pos.y-rad*1e6:keep.add(item.m_Uuid.AsString())
nodes=[]
for n in parse(SRC.read_text()):
 if isinstance(n,list):
  if n[0] in ['segment','via','arc','footprint'] and uid(n) not in keep:continue
  if n[0]=='zone':n=[v for v in n if not isinstance(v,list) or v[0]!='filled_polygon']
 nodes.append(n)
initial=check(nodes,'radius-2');assert len(initial['target'])==1 and len(initial['errors'])==1
base=parse((D/'radius-2/board.kicad_pcb').read_text())
ZONE='cbaef996-a5ad-5073-a292-fe94da38fab6'
for n in base:
 if isinstance(n,list) and n[0]=='zone':n[:]=[x for x in n if not isinstance(x,list) or x[0]!='filled_polygon']
target_fp=next(uid(n) for n in base if isinstance(n,list) and n[0]=='footprint' and any(isinstance(p,list) and p[0]=='pad' and uid(p)==TARGET for p in n))
candidates=[]
def walk(n):
 if not isinstance(n,list):return
 if n[0] in ['footprint','pad','segment','via','arc','zone'] and uid(n) not in [TARGET,ZONE,target_fp]:candidates.append(uid(n))
 for v in n:walk(v)
walk(base);assert None not in candidates
removed=set();rows=[];counter=0
def filtered(n,drop):
 if not isinstance(n,list):return n
 return [filtered(v,drop) for v in n if not(isinstance(v,list) and uid(v) in drop)]
size=max(1,len(candidates)//2)
while True:
 changed=False
 for i in range(0,len(candidates),size):
  chunk=set(candidates[i:i+size]);counter+=1
  row=check(filtered(base,removed|chunk),f'trial-{counter:03d}')
  accepted=len(row['target'])==1 and len(row['errors'])==1
  row['accepted']=accepted;row['attempted_removed_uuids']=sorted(chunk);rows.append(row)
  if accepted:removed|=chunk;changed=True
 candidates=[c for c in candidates if c not in removed]
 if size==1 and not changed:break
 size=max(1,size//2)
(D/'minimal.kicad_pcb').write_text(dump(filtered(base,removed))+'\n')
(D/'reduction.json').write_text(json.dumps(dict(trials=rows,removed_uuids=sorted(removed),remaining_uuids=candidates),indent=2)+'\n')
for i in range(3):
 row=check(filtered(base,removed),f'final-{i+1}');assert len(row['target'])==1 and len(row['errors'])==1
