"""Isolate load/connectivity/save effects without zone refill or DRC."""
import json,pathlib,pcbnew
root=pathlib.Path(__file__).resolve().parent
source=root/'results/track-0-path-0/submitted-reconstructed.kicad_pcb'
board=pcbnew.LoadBoard(str(source));assert board
rows=[]
def record(stage):
 rows.append(dict(stage=stage,tracks=sorted([dict(uuid=t.m_Uuid.AsString(),net=t.GetNetname()) for t in board.GetTracks()],key=lambda t:t['uuid'])))
record('load')
assert board.GetConnectivity().Build(board)
record('connectivity-build')
assert pcbnew.SaveBoard(str(root/'save-only.kicad_pcb'),board)
record('save')
(root/'load-control.json').write_text(json.dumps(rows,indent=2)+'\n')
print('load/build/save-only recorded without DRC/refill')
