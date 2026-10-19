"""Audit native copper of every changed full-suite session; no routing or checking."""
from pathlib import Path
from collections import Counter
import hashlib,json,math,sys
import pcbnew
before,after,comparison,out=map(Path,sys.argv[1:]);assert not out.exists()
d=json.loads(comparison.read_text());raw=[{(r['case'],r['seed']):r for r in json.loads((root/'results.json').read_text())}for root in [before,after]]
def tracks(board):
 result=[]
 for t in board.GetTracks():
  if isinstance(t,pcbnew.PCB_VIA):continue
  a,b=sorted([(t.GetStart().x,t.GetStart().y),(t.GetEnd().x,t.GetEnd().y)])
  assert not isinstance(t,pcbnew.PCB_ARC),'Arc needs an explicit curved-copper audit'
  result.append((t.GetNetname(),int(t.GetLayer()),t.GetWidth(),*a,*b))
 return Counter(result)
def vias(board):
 return Counter((t.GetNetname(),t.GetPosition().x,t.GetPosition().y,t.GetWidth(),t.GetDrillValue(),int(t.GetViaType()),int(t.TopLayer()),int(t.BottomLayer()))for t in board.GetTracks()if isinstance(t,pcbnew.PCB_VIA))
rows=[]
for r in d['attempts']:
 if r['same_ses']:continue
 key=(r['case'],r['seed']);records=[x[key]for x in raw];paths=[root/x['evidence']/'final.kicad_pcb'for root,x in zip([before,after],records)]
 for p,x in zip(paths,records):assert hashlib.sha256(p.read_bytes()).hexdigest()==x['check']['board_sha256']
 boards=[pcbnew.LoadBoard(str(p))for p in paths];a,b=map(tracks,boards);removed=list((a-b).elements());added=list((b-a).elements())
 assert not removed and added and vias(boards[0])==vias(boards[1]);assert all(x['opens']==v for x,v in zip(records,[1,0]))and all(x['new_errors']==0 for x in records)
 width=sorted({t[2]/1e6 for t in added});assert width==[0.25]
 rows.append({'case':r['case'],'seed':r['seed'],'board_sha256':[x['check']['board_sha256']for x in records],'all_old_track_segments_retained':True,'all_old_vias_identical':True,'removed_segments':removed,'added_segments':added,'added_widths_mm':width,'added_length_mm':sum(math.hypot(t[5]-t[3],t[6]-t[4])/1e6 for t in added),'native_opens':[x['opens']for x in records],'native_new_errors':[x['new_errors']for x in records]})
assert len(rows)==6 and all(len(r['added_segments'])==6 for r in rows)
out.write_text(json.dumps({'scope':'Six changed checked full-suite outputs; exact native track multiset/via preservation, no fresh native runs','native_version':pcbnew.Version(),'rows':rows},indent=2)+'\n');print(json.dumps({'audited':len(rows),'all_old_tracks_and_vias_retained':True,'added_segments_each':6,'width_mm':0.25}))
