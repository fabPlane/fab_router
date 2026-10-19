"""Extract a measured native connection from the full paired benchmark; no copper generation or rerouting."""
from pathlib import Path
from collections import Counter
import hashlib,json,sys
import pcbnew
before,after,out=map(Path,sys.argv[1:]);assert not out.exists()
paths=[]
for root in [before,after]:
 row=next(r for r in json.loads((root/'results.json').read_text())if r['case']=='paperino-hw-paperino-shield-j4'and r['seed']==1)
 paths.append(root/row['evidence']/'refilled.kicad_pcb')
selected=[json.loads(p.with_name('check.json').read_text())for p in paths]
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==r['board_sha256']for p,r in zip(paths,selected))
boards=[pcbnew.LoadBoard(str(p))for p in paths]
def segment(t):
 a,b=sorted([(t.GetStart().x,t.GetStart().y),(t.GetEnd().x,t.GetEnd().y)])
 return (t.GetNetCode(),int(t.GetLayer()),t.GetWidth(),*a,*b)
tracks=[[segment(t)for t in b.GetTracks()if not isinstance(t,pcbnew.PCB_VIA)]for b in boards]
removed=Counter(tracks[0])-Counter(tracks[1]);added=list((Counter(tracks[1])-Counter(tracks[0])).elements());assert added
# Select the net/layer with the longest added centerline, preserving all evidence.
import math
choices={(t[0],t[1])for t in added}
net,layer=max(sorted(choices),key=lambda k:sum(math.hypot(t[5]-t[3],t[6]-t[4])for t in added if t[:2]==k))
added=[t for t in added if t[:2]==(net,layer)]
data=[]
for board,segments in zip(boards,tracks):
 vias=[]
 for item in board.GetTracks():
  if isinstance(item,pcbnew.PCB_VIA)and item.GetLayerSet().Contains(layer):
   vias.append({'net':item.GetNetCode(),'x':item.GetPosition().x,'y':item.GetPosition().y,'diameter':item.GetWidth(layer),'drill':item.GetDrillValue()})
 pads=[]
 for fp in board.GetFootprints():
  for pad in fp.Pads():
   if pad.GetLayerSet().Contains(layer):
    b=pad.GetBoundingBox();pads.append({'net':pad.GetNetCode(),'x0':b.GetX(),'y0':b.GetY(),'x1':b.GetRight(),'y1':b.GetBottom()})
 data.append({'segments':[s for s in segments if s[1]==layer],'vias':vias,'pads':pads})
assert Counter(json.dumps(v,sort_keys=True)for v in data[0]['vias'])==Counter(json.dumps(v,sort_keys=True)for v in data[1]['vias'])
result={'scope':'Measured native candidate copper, selected net/layer with longest added centerline; pad bounds are visual context only; no global retention claim from this view','native_version':pcbnew.Version(),'board_sha256':[hashlib.sha256(p.read_bytes()).hexdigest()for p in paths],'net':net,'net_name':boards[1].FindNet(net).GetNetname(),'layer':layer,'layer_name':boards[1].GetLayerName(layer),'added_segments':added,'removed_segments':list(removed.elements()),'boards':data,'opens':[r['opens']for r in selected],'new_errors':[r['new_errors']for r in selected]}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k!='boards'}))
