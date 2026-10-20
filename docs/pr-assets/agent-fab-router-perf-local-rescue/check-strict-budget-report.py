"""Positive control and evidence-tampering controls; no routing or native checks."""
from pathlib import Path
import copy
import json
import subprocess
import sys

captures, out = map(Path, sys.argv[1:])
assert not out.exists()
out.mkdir(parents=True)
reporter = Path(__file__).with_name('report-strict-budget.py')
normal = json.loads((captures/'normal-1.json').read_text())
candidate = json.loads((captures/'candidate-1.json').read_text())
mutations = {
    'changed-settings': lambda r: r['settings'].update({'timeoutSeconds': 301}),
    'changed-expected': lambda r: r['result']['expected'].update({'incomplete': {'max': 31}}),
    'added-violation': lambda r: r['result']['measured'].update({'violationsAdded': 1}),
    'changed-source': lambda r: r['sourceHashes'].update({'src/api.ts': '0'*64}),
    'changed-board': lambda r: r.update({'boardSha256': '0'*64}),
    'not-timeout': lambda r: r['result']['measured'].update({'timedOut': False}),
}
rows = []
for name, mutate in [('control', None), *mutations.items()]:
    d = out/name
    d.mkdir()
    (d/'normal-1.json').write_text(json.dumps(normal))
    r = copy.deepcopy(candidate)
    if mutate:
        mutate(r)
    (d/'candidate-1.json').write_text(json.dumps(r))
    p = subprocess.run([sys.executable, str(reporter), str(d), str(d/'report')],
                       text=True, capture_output=True, timeout=30)
    (d/'stdout.txt').write_text(p.stdout)
    (d/'stderr.txt').write_text(p.stderr)
    assert (p.returncode == 0) == (mutate is None), (name, p.returncode)
    rows.append({'name': name, 'exit': p.returncode,
                 'expected': 'pass' if mutate is None else 'reject', 'correct': True})
summary = {'controls': rows}
(out/'controls.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary))
