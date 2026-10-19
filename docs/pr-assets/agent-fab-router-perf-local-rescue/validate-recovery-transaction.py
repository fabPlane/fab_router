"""Reproduce the real-fixture gate checks and four deliberate bypass mutations.

Usage: python3 validate-recovery-transaction.py SOURCE UNUSED_OUTPUT
No production source is changed. Links in disposable trees reference SOURCE.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

source = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
output.mkdir()  # Refuse to overwrite prior evidence.
helper = pathlib.Path('docs/pr-assets/agent-fab-router-perf-local-rescue/recovery-transaction.ts')
test = pathlib.Path('test/near-complete-endpoint.test.ts')
captured = {p: (source / p).read_bytes() for p in [test, helper]}
mutations = [
    ('control', None, None, None),
    ('no-drc', "if(checkDrc(layout).counts.violations)return 'drc';", "if(false)return 'drc';", 'Expected: "drc"'),
    ('no-terminals', "if(groups.some(g=>g.some(id=>!same(after,g[0]!,id))))return 'terminals';", "if(false)return 'terminals';", 'Expected: "terminals"'),
    ('no-rewind', 'if(!kept)journal.rewind(mark);', 'if(!kept)void mark;', 'expect(received).toBe(expected)'),
    ('no-retained', "if(retained()!==retainedBefore)return 'retained';", "if(false)return 'retained';", 'Expected: "retained"'),
]
rows = []
for name, old, new, diagnostic in mutations:
    dest = output / name
    dest.mkdir()
    for entry in ['src', 'spec']:
        (dest / entry).symlink_to(source / entry, target_is_directory=True)
    (dest / 'test').mkdir()
    (dest / 'test/data').symlink_to(source / 'test/data', target_is_directory=True)
    (dest / test).write_bytes(captured[test])
    gate = captured[helper].decode()
    if old is not None:
        assert gate.count(old) == 1, name
        gate = gate.replace(old, new)
    (dest / helper).parent.mkdir(parents=True)
    (dest / helper).write_text(gate)
    command = ['taskset', '-c', '12-19', 'nice', '-n', '10', 'timeout', '120', 'bun', 'test', str(dest / test)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=150)
    log = result.stdout + result.stderr
    (output / f'{name}.txt').write_text(log)
    if name == 'control':
        assert result.returncode == 0 and '1 pass' in log and '219 expect() calls' in log, log
    else:
        assert result.returncode == 1 and '1 fail' in log and diagnostic in log, log
    rows.append({'variant': name, 'exit': result.returncode, 'expected_outcome_observed': True})
assert all((source / p).read_bytes() == contents for p, contents in captured.items()), 'Source changed during validation'
report = {
    'scope': 'Real-fixture transaction regression and deliberate bypass controls; not native routing benchmarks.',
    'sha256': {str(p): hashlib.sha256(contents).hexdigest() for p, contents in captured.items()},
    'control_repeats': 3,
    'rows': rows,
}
(output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
