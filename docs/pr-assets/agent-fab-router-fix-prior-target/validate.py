#!/usr/bin/env python3
"""Check the repeated driver and public API evidence."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent
for label in ('before', 'after'):
    rows = json.loads((root / f'{label}.json').read_text())
    assert len(rows) == 6
    assert {(r['repeat'], r['concave']) for r in rows} == {(i, c) for i in (1, 2, 3) for c in (False, True)}
    for r in rows:
        assert r['success'] is True
        assert r['opens'] == (1 if label == 'before' else 0)
        assert r['violations'] == 0
        assert r['publicResult']['opens'] == r['opens']
        assert r['publicResult']['violations'] == 0
        assert r['before']['pads'] == r['after']['pads']
        assert r['before']['pours'] == r['after']['pours']
        for t in r['before']['tracks']:
            assert t in r['after']['tracks']
print('Both geometries, three repeats: driver and public API opens 1 → 0; zero engine DRC.')
