#!/usr/bin/python3
"""Replay recorded native candidates; does not rerun native checks or route."""
import importlib.util
import json
from pathlib import Path
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('selection', here / 'select-dogleg.py')
selection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selection)
results = []
for name in sys.argv[1:]:
    root = Path(name)
    summary = json.loads((root / 'summary.json').read_text())
    baseline = summary['rows'][0]
    for row in summary['rows']:
        assert selection.eligible(baseline, row) == row['eligible']
    count = len(summary['rows']) // 3
    for repeat in range(3):
        trials = summary['rows'][repeat*count:(repeat+1)*count]
        accepted = [row for row in trials if selection.eligible(trials[0], row)]
        winner = min(accepted, key=lambda row: (len(row['errors']), row['opens'], row['label'])) if accepted else trials[0]
        assert winner['label'] == summary['selections'][repeat]
    results.append(dict(dataset=root.name, rows=len(summary['rows']),
                        decisions_unchanged=True, selections=summary['selections']))
assert results
print(json.dumps(results, indent=2))
