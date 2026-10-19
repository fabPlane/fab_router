#!/usr/bin/python3
"""Diagnostic regression: error order is irrelevant; multiplicity and findings are not."""
import copy
import importlib.util
import json
from pathlib import Path
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('geometry', here / 'geometry-doglegs.py')
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
if len(sys.argv) > 1:
    exec(compile(Path(sys.argv[1]).read_text(), sys.argv[1], 'exec'), geometry.__dict__)
results = []
for repeat in range(3):
    base = dict(errors=[{'type': 'thermal'}, {'type': 'clearance'}], opens=1,
                groups={'a': ['a']}, eligible=False)
    for kind in ('unchanged', 'reordered', 'duplicate', 'replacement', 'opens', 'groups', 'eligible'):
        trial = copy.deepcopy(base)
        if kind == 'reordered': trial['errors'].reverse()
        if kind == 'duplicate': trial['errors'].append(trial['errors'][0])
        if kind == 'replacement': trial['errors'][0] = {'type': 'new'}
        if kind == 'opens': trial['opens'] += 1
        if kind == 'groups': trial['groups']['b'] = ['b']
        if kind == 'eligible': trial['eligible'] = True
        try:
            # Before-source uses the exact inline predicate replaced by same_outcome.
            same = (geometry.same_outcome(base, trial) if hasattr(geometry, 'same_outcome') else
                    all(trial[f] == base[f] for f in ('errors', 'opens', 'groups', 'eligible')))
            results.append(dict(repeat=repeat+1, control=kind, same=same))
        except Exception:
            raise
print(json.dumps(results, indent=2))
assert all(r['same'] == (r['control'] in ('unchanged', 'reordered')) for r in results)
