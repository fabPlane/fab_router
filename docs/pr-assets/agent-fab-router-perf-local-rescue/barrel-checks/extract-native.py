"""Extract a measured dense-board connection from native copper, without rerouting."""
from pathlib import Path
from collections import Counter
import hashlib,json,sys
import pcbnew
run,out=map(Path,sys.argv[1:]);assert not out.exists()
rows=json.loads((run/'results.json').read_text());selected=[next(r for r in rows if r['version']==v and r['repeat']==1)for v in ['before','after']]
paths=[run/'runs'/r['record']['attempt']/'fab-router/work/output.kicad_pcb'for r in selected]
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==r['check']['raw_output_sha256']for p,r in zip(paths,selected))
boards=[pcbnew.LoadBoard(str(p))for p in paths]
def segment(t):
 a,b=sorted([(t.GetStart().x,t.GetStart().y),(t.GetEnd().x,t.GetEnd().y)])
 return (t.GetNetCode(),int(t.GetLayer()),t.GetWidth(),*a,*b)
tracks=[[segment(t)for t in board.GetTracks()if not isinstance(t,pcbnew.PCB_VIA)]for board in boards]
removed=Counter(tracks[0])-Counter(tracks[1]);added=list((Counter(tracks[1])-Counter(tracks[0])).elements());assert not removed and added
nets={t[0]for t in added};layers={t[1]for t in added};assert len(nets)==len(layers)==1
net=next(iter(nets));layer=next(iter(layers));data=[]
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
result={'scope':'Native copper on new connection layer; all preexisting track geometry retained; pad bounding boxes are visual context only','native_version':pcbnew.Version(),'board_sha256':[hashlib.sha256(p.read_bytes()).hexdigest()for p in paths],'net':net,'net_name':boards[1].FindNet(net).GetNetname(),'layer':layer,'layer_name':boards[1].GetLayerName(layer),'added_segments':added,'removed_segments':list(removed.elements()),'boards':data,'opens':[r['check']['opens']for r in selected],'new_errors':[r['check']['new_errors']for r in selected]}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k!='boards'}))
