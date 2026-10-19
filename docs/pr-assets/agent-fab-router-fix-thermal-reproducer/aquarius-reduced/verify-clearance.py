#!/usr/bin/python3
"""Independently verify retained clearance isolation hashes and native reports."""
import hashlib
import json
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = json.loads((p / 'summary.json').read_text())
assert s['repeats'] == 3 and s['native_version'] == '10.0.6'
assert len(s['rows']) == 9
for label, count, pairs in [('baseline', 6, 0), ('adverse', 7, 1), ('restore-segment-keep-links', 6, 0)]:
    rows = [r for r in s['rows'] if r['label'] == label]
    assert len(rows) == 3
    for r in rows:
        for name, digest in r['sha256'].items():
            assert hashlib.sha256((p / r['name'] / name).read_bytes()).hexdigest() == digest
        report = json.loads((p / r['name'] / 'drc.json').read_text())
        assert r['errors'] == [e for e in report['violations'] if e['severity'] == 'error']
        assert len(r['errors']) == count and len(r['pair_errors']) == pairs
        assert len(report['unconnected_items']) == r['opens'] == 15
        assert r['errors'] == rows[0]['errors']
        assert sum(e['type'] == 'starved_thermal' for e in r['errors']) == 6
        for e in r['pair_errors']:
            assert e['type'] == 'clearance'
            assert {i['uuid'] for i in e['items']} == {s['track_uuid'], s['pad_uuid']}
base = next(r for r in s['rows'] if r['label'] == 'baseline')
restored = next(r for r in s['rows'] if r['label'] == 'restore-segment-keep-links')
assert base['errors'] == restored['errors']
print('Verified all nine native reports, hashes, repeated outcomes and implicated clearance pair.')
