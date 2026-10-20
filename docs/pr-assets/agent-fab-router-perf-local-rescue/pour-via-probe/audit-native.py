import sys
"""Check exact retained native copper and new via against exported design floors."""
from pathlib import Path
from collections import Counter
import json,hashlib
import pcbnew
s=Path(sys.argv[1]).resolve()
rules=json.loads((s/'inputs/dsn-manifest.json').read_text())['native_rules']
def copper(b):
 rows=[]
 for t in b.GetTracks():
  if isinstance(t,pcbnew.PCB_VIA):rows.append(('via',t.GetNetname(),t.GetPosition().x,t.GetPosition().y,t.GetWidth(pcbnew.F_Cu),t.GetDrillValue(),tuple(t.GetLayerSet().Seq())))
  else:
   a,c=sorted([(t.GetStart().x,t.GetStart().y),(t.GetEnd().x,t.GetEnd().y)])
   rows.append(('track',t.GetNetname(),int(t.GetLayer()),t.GetWidth(),*a,*c))
 return Counter(rows)
def partition(board):
 c=board.GetConnectivity();assert c.Build(board)
 pads={p.m_Uuid.AsString():p for p in board.GetPads()if p.GetNetCode()>0};groups={}
 for key,pad in pads.items():
  members={key}|{p.m_Uuid.AsString()for p in c.GetConnectedItems(pad)if p.GetClass()=='PAD'and p.m_Uuid.AsString()in pads}
  assert all(pads[m].GetNetname()==pad.GetNetname()for m in members)
  groups[key]=sorted(members)
 assert all(groups[m]==group for group in groups.values()for m in group)
 return groups
results=[]
for repeat in range(1,4):
 paths=[s/f'native-probe/{m}-{repeat}/final.kicad_pcb'for m in ['before','after']]
 boards=[pcbnew.LoadBoard(str(p))for p in paths];b,a=map(copper,boards)
 assert not b-a
 added=list((a-b).elements());assert len(added)==1
 v=added[0];assert v[:4]==('via','GNDD',151130000,92710000)
 width,drill=v[4:6];assert width==762000 and drill==381000
 assert width/1e6>=rules['min_via_diameter'] and drill/1e6>=rules['min_through_hole_diameter'] and (width-drill)/2e6>=rules['min_via_annular_width']
 # Sidecars copied by the unmodified adapter must remain exact.
 for ext in ['kicad_pro','kicad_dru']:
  expected=Path(sys.argv[2])/'cases/kitspace-aquarius-j4'/('board.'+ext)
  assert all(p.with_suffix('.'+ext).read_bytes()==expected.read_bytes()for p in paths)
 before,after=map(partition,boards);assert before.keys()==after.keys()
 lost=[[left,right]for left,group in before.items()for right in group if left<right and right not in after[left]]
 assert not lost
 via=next(t for t in boards[1].GetTracks()if isinstance(t,pcbnew.PCB_VIA)and t.GetPosition().x==151130000 and t.GetPosition().y==92710000)
 connected_pads=sorted(p.m_Uuid.AsString()for p in boards[1].GetConnectivity().GetConnectedItems(via)if p.GetClass()=='PAD')
 assert connected_pads
 results.append({'terminal_groups_before':before,'terminal_groups_after':after,'lost_terminal_pairs':lost,'identical_terminal_partition':before==after,'new_via_connected_pad_count':len(connected_pads),'repeat':repeat,'retained_copper_items':sum(b.values()),'added_copper':added,'via_minima_pass':True,'sidecars_exact':True,'board_sha256':[hashlib.sha256(p.read_bytes()).hexdigest()for p in paths]})
(s/'native-geometry-audit.json').write_text(json.dumps({'native_version':pcbnew.Version(),'native_rules':rules,'rows':results},indent=2)+'\n');print('PASS native retained copper, measured via floors and exact sidecars: 3 paired repeats')
