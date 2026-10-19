#!/usr/bin/python3
"""Geometry regression for bounded, endpoint-preserving local detours."""
import importlib.util
from pathlib import Path
import native
spec = importlib.util.spec_from_file_location('local_detour', Path(__file__).with_name('local-detour.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def segment(a, b):
    return native.parse(f'(segment (start {a}) (end {b}) (width 0.2) (layer "F.Cu") (net 1) (uuid "sample"))')

def points(parts):
    return [[tuple(round(float(v)*1e6) for v in native.child(p, key)[1:]) for key in ('start', 'end')] for p in parts]

for start, end, centre in [('0 0', '10 0', (5000000, 100000)), ('10 0', '0 0', (5000000, 100000)),
                           ('0 0', '0 10', (100000, 5000000)), ('0 0', '10 10', (5000000, 5000000))]:
    original = segment(start, end)
    result = m.detour(original, centre, 1000000, 200000)
    assert original == segment(start, end), 'input mutated'
    pairs = points(result)
    assert len(pairs) == 5 and pairs[0][0] == points([original])[0][0] and pairs[-1][1] == points([original])[0][1]
    assert all(a[1] == b[0] for a, b in zip(pairs, pairs[1:])), 'broken chain'
    assert len({native.uid(p) for p in result}) == 5 and native.uid(result[0]) == 'sample'
    assert all(native.child(p, k) == native.child(original, k) for p in result for k in ('width', 'layer', 'net'))
    assert result == m.detour(original, centre, 1000000, 200000), 'nondeterministic UUIDs'
    print('PASS', start, end)
assert points(m.detour(segment('0 0','10 0'),(5000000,100000),1000000,200000)) == [
    [(0,0),(4000000,0)],[(4000000,0),(4000000,200000)],
    [(4000000,200000),(6000000,200000)],[(6000000,200000),(6000000,0)],
    [(6000000,0),(10000000,0)]]
for original, centre, radius, shift in [(segment('0 0', '0 0'), (0,0), 1, 1),
        (segment('0 0', '10 0'), (0,0), 1000000, 200000),
        (segment('0 0', '10 0'), (5000000,0), 0, 200000),
        (segment('0 0', '10 0'), (5000000,0), 1000000, 0)]:
    assert m.detour(original, centre, radius, shift) is None
print('PASS: four orientations and four degenerate/endpoint controls')
