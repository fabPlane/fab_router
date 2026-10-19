#!/usr/bin/python3
"""Regression: reject inventory-changing trials without aborting candidate search."""
import copy
import importlib.util
import json
from pathlib import Path
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('selection', here / 'select-dogleg.py')
selection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selection)
if len(sys.argv) > 1:
    # Preserve sibling import paths while probing a retained earlier source file.
    exec(compile(Path(sys.argv[1]).read_text(), sys.argv[1], 'exec'), selection.__dict__)
results = []
for repeat in range(3):
    base = dict(errors=[{'type': 'thermal'}, {'type': 'other'}], opens=1,
                groups={'a': ['a'], 'b': ['b']})
    good = copy.deepcopy(base)
    good['errors'].pop()
    for kind in ('unchanged', 'removed', 'added', 'replaced'):
        trial = copy.deepcopy(good)
        if kind in ('removed', 'replaced'):
            del trial['groups']['b']
        if kind in ('added', 'replaced'):
            trial['groups']['c'] = ['c']
        try:
            accepted = selection.eligible(base, trial)
            result = 'accepted' if accepted else 'rejected'
        except AssertionError:
            result = 'aborted'
        results.append(dict(repeat=repeat+1, control=kind, result=result))
    invalid = copy.deepcopy(good)
    del invalid['groups']['b']
    try:
        accepted = [trial for trial in (invalid, good) if selection.eligible(base, trial)]
        continued = accepted == [good]
    except AssertionError:
        continued = False
    results.append(dict(repeat=repeat+1, control='continue', result='accepted' if continued else 'aborted'))
print(json.dumps(results, indent=2))
assert all(row['result'] == ('accepted' if row['control'] in ('unchanged', 'continue') else 'rejected')
           for row in results), 'inventory changes must reject candidates without aborting'
assert selection.controls() == 6
