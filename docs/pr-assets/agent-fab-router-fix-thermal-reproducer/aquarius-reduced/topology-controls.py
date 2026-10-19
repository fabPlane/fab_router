#!/usr/bin/python3
"""Synthetic controls for non-mutating polygon overlap used in topology ranking."""
import importlib.util
import json
from pathlib import Path
import sys
import pcbnew
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('topology', HERE/'topology-doglegs.py')
topology = importlib.util.module_from_spec(spec)
spec.loader.exec_module(topology)


def rectangle(x, y, w, h):
    p = pcbnew.SHAPE_POLY_SET()
    p.NewOutline()
    for point in ((x,y),(x+w,y),(x+w,y+h),(x,y+h)):
        p.Append(*point)
    return p


rows=[]
for repeat in range(3):
    a=rectangle(0,0,10000,10000)
    b=rectangle(5000,0,10000,10000)
    distant=rectangle(20000,0,10000,10000)
    hole=rectangle(2000,2000,6000,6000)
    ring=pcbnew.SHAPE_POLY_SET(a)
    ring.BooleanSubtract(hole)
    checks={
        'self': topology.overlap(a,a)==100000000,
        'partial': topology.overlap(a,b)==50000000,
        'symmetric': topology.overlap(a,b)==topology.overlap(b,a),
        'disjoint': topology.overlap(a,distant)==0,
        'hole': topology.overlap(ring,hole)==0,
        'empty': topology.overlap(a,pcbnew.SHAPE_POLY_SET())==0,
        'inputs_unchanged': a.Area()==100000000 and b.Area()==100000000 and ring.Area()==64000000,
    }
    assert all(checks.values()), checks
    rows.append(checks)
Path(sys.argv[1]).write_text(json.dumps(dict(repeats=3,rows=rows),indent=2)+'\n')
