"""One pad + one segment: no refill, DRC, routing, or output mutation needed."""
import json,pathlib,pcbnew
root=pathlib.Path(__file__).resolve().parent
board=pcbnew.LoadBoard(str(root/'load-minimal.kicad_pcb'));assert board
tracks=[dict(uuid=t.m_Uuid.AsString(),net=t.GetNetname()) for t in board.GetTracks()]
assert tracks==[dict(uuid='00000000-0000-0000-0000-000000000003',net='SIGNAL_B')]
print(json.dumps(tracks));print('submitted SIGNAL_A becomes SIGNAL_B at native load: PASS')
