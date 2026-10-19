#!/usr/bin/python3
"""Replay retained native reports through the order-independent repeat guard."""
import importlib.util
import hashlib
import json
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('geometry', here / 'geometry-doglegs.py')
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
results = []
for name, filename in [('r20-results', 'audit.json'), ('wide-results', 'summary.json'), ('c1-results', 'summary.json')]:
    summary = json.loads((here / name / filename).read_text())
    rows = summary['rows']
    for row in rows:
        for filename, digest in row['sha256'].items():
            assert hashlib.sha256((here / name / row['name'] / filename).read_bytes()).hexdigest() == digest
        board = geometry.native.pcbnew.LoadBoard(str(here / name / row['name'] / 'board.kicad_pcb'))
        groups = geometry.selection.terminals.partition(board)
        if 'groups' in row: assert row['groups'] == groups
        row['groups'] = groups
    labels = sorted({r['name'].rsplit('-', 1)[0] for r in rows})
    reordered = []
    for label in labels:
        group = [r for r in rows if r['name'].rsplit('-', 1)[0] == label]
        assert len(group) == 3
        # Audit rows omit eligibility: recompute it from the same repeat baseline.
        for row in group:
            report = json.loads((here / name / row['name'] / 'drc.json').read_text())
            assert row['errors'] == [e for e in report['violations'] if e['severity'] == 'error']
            baseline = next(r for r in rows if r['name'] == 'baseline-' + row['name'].rsplit('-', 1)[1])
            row['eligible'] = geometry.selection.eligible(baseline, row)
        assert all(geometry.same_outcome(group[0], r) for r in group)
        if any(r['errors'] != group[0]['errors'] for r in group): reordered.append(label)
    results.append(dict(dataset=name, reports=len(rows), repeat_groups=len(labels), reordered=reordered))
print(json.dumps(dict(production_fix=False, fresh_native_checks=0, results=results), indent=2))
