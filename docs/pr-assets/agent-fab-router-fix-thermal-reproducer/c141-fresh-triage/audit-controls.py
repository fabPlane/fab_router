"""Exercise comparison rejection/detection without running a router."""
import copy
import json
import sys
from pathlib import Path
from triage import audit, load

rows = load(Path(sys.argv[1]))
controls = {}
missing = copy.deepcopy(rows)
del missing[next(iter(missing))]
try:
    audit(rows, missing)
except AssertionError:
    controls["missing_run_rejected"] = True
changed = copy.deepcopy(rows)
next(iter(changed.values()))["opens"] += 1
controls["changed_open_detected"] = len(audit(rows, changed)["changed_case_seeds"]) == 1
controls["matched_run_unchanged"] = audit(rows, rows)["changed_case_seeds"] == []
assert len(controls) == 3 and all(controls.values())
print(json.dumps(controls, indent=2))
