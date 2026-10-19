#!/usr/bin/python3
"""Native synthetic controls for nearby-track filtering and direction covariance."""
import importlib.util
from pathlib import Path
import math
import pcbnew as pcb

spec = importlib.util.spec_from_file_location('geometry', Path(__file__).with_name('geometry-doglegs.py'))
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
b = pcb.BOARD()
net = pcb.NETINFO_ITEM(b, 'foreign', 1)
b.Add(net)
f = pcb.FOOTPRINT(b)
b.Add(f)
p = pcb.PAD(f)
p.SetAttribute(pcb.PAD_ATTRIB_SMD)
layers = pcb.LSET()
layers.AddLayer(pcb.F_Cu)
p.SetLayerSet(layers)
p.SetPosition(pcb.VECTOR2I(0, 0))
f.Add(p)

def track(x1, y1, x2, y2, layer=pcb.F_Cu, foreign=True):
    t = pcb.PCB_TRACK(b)
    t.SetStart(pcb.VECTOR2I(x1, y1))
    t.SetEnd(pcb.VECTOR2I(x2, y2))
    t.SetLayer(layer)
    if foreign:
        t.SetNet(net)
    b.Add(t)
    return t

near = track(-1000, 100, 1000, 100)
far = track(-1000, 200, 1000, 200)
track(0, 0, 0, 0)  # Degenerate track must never divide by zero.
track(-1000, 10, 1000, 10, pcb.B_Cu)
track(-1000, 20, 1000, 20, foreign=False)
rows = geometry.nearby(b, p)
assert [r['uuid'] for r in rows] == [near.m_Uuid.AsString(), far.m_Uuid.AsString()]
assert [r['distance_nm'] for r in rows] == [100, 200]
assert rows[0]['normal'] == [0, 1]
near.SetStart(pcb.VECTOR2I(1000, 100))
near.SetEnd(pcb.VECTOR2I(-1000, 100))
reversed_row = geometry.nearby(b, p)[0]
assert reversed_row['distance_nm'] == 100
assert reversed_row['normal'] == [0, -1]  # Both signs produce the identical candidate set.
near.SetStart(pcb.VECTOR2I(-100, -1000))
near.SetEnd(pcb.VECTOR2I(-100, 1000))
rotated = geometry.nearby(b, p)[0]
assert rotated['distance_nm'] == 100 and rotated['normal'] == [-1, 0]
assert math.isclose(math.hypot(*rotated['normal']), 1)
assert len(geometry.nearby(b, p, limit=1)) == 1
print('PASS: net/layer/zero-length filtering, distance ranking, endpoint reversal, rotation and bound controls')
