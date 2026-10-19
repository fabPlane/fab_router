#!/usr/bin/python3
"""Static 45-degree chamfer sweep; no routing policy or scored gain."""
import copy
import importlib.util
from pathlib import Path
import uuid

p = Path(__file__).resolve().parent.parent / 'c168-j4-detour/measure.py'
s = importlib.util.spec_from_file_location('detour', p)
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)
original_variants = m.variants


def variants(witness):
    for label, segments in original_variants(witness):
        if label in ('original-segment', 'removed', 'upper-right'):
            yield label, segments
    start = tuple(float(v) for v in m.native.child(witness, 'start')[1:])
    end = tuple(float(v) for v in m.native.child(witness, 'end')[1:])
    assert start[0] > end[0] and start[1] > end[1]
    for radius in (0.125, 0.25, 0.5, 1.0, 1.5, 2.0):
        assert radius < min(start[0]-end[0], start[1]-end[1])
        points = [start, (start[0], end[1]+radius),
                  (start[0]-radius, end[1]), end]
        segments = []
        for index, (a, b) in enumerate(zip(points, points[1:])):
            segment = copy.deepcopy(witness)
            m.native.child(segment, 'start')[1:] = [f'{v:.6f}' for v in a]
            m.native.child(segment, 'end')[1:] = [f'{v:.6f}' for v in b]
            m.native.child(segment, 'uuid')[1] = '"' + str(uuid.uuid5(
                uuid.NAMESPACE_URL, f'j4-chamfer-{radius}-{index}')) + '"'
            assert abs(a[0]-b[0]) < 1e-9 or abs(a[1]-b[1]) < 1e-9 or abs(abs(a[0]-b[0])-abs(a[1]-b[1])) < 1e-9
            segments.append(segment)
        yield f'chamfer-{radius}', segments


if __name__ == '__main__':
    m.variants = variants
    m.main()
