#!/usr/bin/python3
"""Verify retained selection files, repeated reports and terminal groups."""
import hashlib
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
summary = json.loads((path / 'summary.json').read_text())
assert summary['controls'] == 6
assert summary['repeats'] == 3
assert len(summary['rows']) == 15
for row in summary['rows']:
    for name, digest in row['sha256'].items():
        assert hashlib.sha256((path / row['name'] / name).read_bytes()).hexdigest() == digest
    report = json.loads((path / row['name'] / 'drc.json').read_text())
    assert row['errors'] == [e for e in report['violations'] if e['severity'] == 'error']
    assert row['opens'] == len(report['unconnected_items']) == 15
    assert len(row['groups']) == 234
    assert row['groups'] == summary['rows'][0]['groups']
for label in {r['label'] for r in summary['rows']}:
    group = [r for r in summary['rows'] if r['label'] == label]
    assert len(group) == 3
    for field in ('errors', 'opens', 'eligible', 'target', 'groups'):
        assert all(r[field] == group[0][field] for r in group)
assert [r['selected'] for r in summary['selections']] == ['track-2-offset-1'] * 3
print('Verified 15 native reports and artifact hashes; repeated selections and 234 terminal groups agree.')
