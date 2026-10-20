"""Read retained native-filled zone topology. No refill, DRC, or save occurs."""
import pcbnew,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);rows=[]
for name in ['source','trial-031','final-0']:
 board=pcbnew.LoadBoard(str(root/'minimized'/name/'board.kicad_pcb'))
 for zone in board.Zones():
  if zone.GetNetname()!='GNDD' or not zone.IsOnLayer(pcbnew.B_Cu):continue
  filled=zone.GetFilledPolysList(pcbnew.B_Cu)
  rows.append(dict(name=name,net=zone.GetNetname(),layer='B.Cu',uuid=zone.m_Uuid.AsString(),outlineCount=filled.OutlineCount(),holeCount=sum(filled.HoleCount(i) for i in range(filled.OutlineCount()))))
assert [r['outlineCount'] for r in rows]==[1,1,2]
assert {r['uuid'] for r in rows}=={'cbaef996-a5ad-5073-a292-fe94da38fab6'}
print(json.dumps(rows,indent=2))
