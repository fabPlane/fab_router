"""Independent native copper and terminal audit of offline alternate anchors."""
from pathlib import Path
from collections import Counter
import json,hashlib,sys
import pcbnew
s=Path(sys.argv[1]).resolve();bench=Path(sys.argv[2]).resolve()
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

rows=[]
def clean(v):
 if isinstance(v,dict):return {k:clean(x)for k,x in v.items()if k!='uuid'}
 if isinstance(v,list):return [clean(x)for x in v]
 return v
for repeat in range(1,4):
 paths=[s/f'native-probe/{m}-{repeat}/final.kicad_pcb'for m in ['before','after']]
 boards=[pcbnew.LoadBoard(str(p))for p in paths];b,a=map(copper,boards)
 assert not b-a
 added=list((a-b).elements());assert added and all(x[0]=='track'for x in added)
 checks=[json.loads(p.with_name('check.json').read_text())for p in paths]
 assert all(checks[i]['board_sha256']==hashlib.sha256(paths[i].read_bytes()).hexdigest()for i in range(2))
 assert [(r['opens'],r['new_errors'],r['vias'])for r in checks]==[(1,0,12),(0,0,12)]
 for finding in ['new_error_details','new_warning_details']:
  old=Counter(json.dumps(clean(v),sort_keys=True)for v in checks[0][finding])
  new=Counter(json.dumps(clean(v),sort_keys=True)for v in checks[1][finding])
  assert not new-old,(finding,new-old)
 for ext in ['kicad_pro','kicad_dru']:
  expected=bench/'cases/photon-sprinkler-sprinkler-j3'/('board.'+ext)
  assert all(p.with_suffix('.'+ext).read_bytes()==expected.read_bytes()for p in paths)
 before,after=map(partition,boards);assert before.keys()==after.keys()
 lost=[[left,right]for left,group in before.items()for right in group if left<right and right not in after[left]]
 gained=[[left,right]for left,group in after.items()for right in group if left<right and right not in before[left]]
 assert not lost and gained
 assert all(r['integrity_pass']for r in checks)
 rows.append({'repeat':repeat,'terminal_groups_before':before,'terminal_groups_after':after,'lost_terminal_pairs':lost,'gained_terminal_pairs':gained,'retained_copper_items':sum(b.values()),'added_copper':added,'sidecars_exact':True,'board_sha256':[hashlib.sha256(p.read_bytes()).hexdigest()for p in paths]})
(s/'native-geometry-audit.json').write_text(json.dumps({'native_version':pcbnew.Version(),'rows':rows},indent=2)+'\n');print('PASS: all old native copper and terminal pairs preserved, native opens 1 to 0, zero new errors, unchanged sidecars')
