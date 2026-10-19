#!/usr/bin/python3
"""Find whether a bounded nearby-track set contains the earlier successful witness."""
import importlib.util
import json
from pathlib import Path
import sys
import native

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('geometry', here / 'geometry-doglegs.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
s = json.loads((here / 'selection-results/summary.json').read_text())
source = Path(next(name for name in s['input_sha256'] if name.endswith('.kicad_pcb')))
before = native.pcbnew.LoadBoard(str(source))
after = native.pcbnew.LoadBoard(str(here / 'selection-results/track-2-offset-1-1/board.kicad_pcb'))
old = {track.m_Uuid.AsString(): track for track in before.GetTracks()}
changed = []
for track in after.GetTracks():
    uid = track.m_Uuid.AsString()
    if uid in old and type(track) == native.pcbnew.PCB_TRACK:
        if tuple(track.GetStart()) != tuple(old[uid].GetStart()) or tuple(track.GetEnd()) != tuple(old[uid].GetEnd()):
            changed.append(uid)
assert len(changed) == 1
pad = next(pad for pad in before.GetPads() if pad.m_Uuid.AsString() == native.TARGET)
ranked = g.nearby(before, pad, limit=len(old))
rank, witness = next((i, r) for i, r in enumerate(ranked, 1) if r['uuid'] == changed[0])
assert rank > 3
Path(sys.argv[1]).write_text(json.dumps(dict(pad_uuid=native.TARGET, bound=3,
    successful_witness_uuid=changed[0], witness_rank=rank, witness_distance_nm=witness['distance_nm'],
    ranked_tracks=ranked, conclusion='Nearest-three search omits an existing successful candidate.'), indent=2)+'\n')
print(f'Existing successful witness ranks {rank}, outside the nearest-three bound.')
