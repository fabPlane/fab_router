#!/usr/bin/env python3
"""Audit three independent fanout fixes with identical tests and pinned sources."""
import argparse
import difflib
import hashlib
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--out', required=True, type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[3]
a.out.mkdir(parents=True, exist_ok=False)
refs = dict(main='69cf598', budget='fe69341c357adf0dd3be0367a53b96ee452c1f24',
            span='05cb41e6f7c88f9694cd1c075265b1e56b2a7391', contact='ceeccc8')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def sha(data):
    return hashlib.sha256(data).hexdigest()
tests = {}
for label, prefix in [('budget', 'fanout-budget'), ('span', 'fanout-span'), ('contact', 'fanout-contact')]:
    for path in git('ls-tree', '-r', '--name-only', refs[label], 'test').decode().splitlines():
        if prefix in path:
            tests[path] = git('show', f'{refs[label]}:{path}')
sources = {}
for label, ref in [*refs.items(), ('composed', refs['contact'])]:
    source = a.out / label
    source.mkdir()
    with tarfile.open(fileobj=io.BytesIO(git('archive', ref))) as archive:
        archive.extractall(source, filter='data')
    (source / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
    for path, data in tests.items():
        (source / path).parent.mkdir(parents=True, exist_ok=True)
        (source / path).write_bytes(data)
    sources[label] = source
composed = sources['composed'] / 'src/route/fanout.ts'
original = composed.read_text()
text = original
for label in ['budget', 'span']:
    patch = git('diff', refs['main'], refs[label], '--', 'src/route/fanout.ts')
    subprocess.run(['git', 'apply', '--'], input=patch, cwd=sources['composed'], check=True)
text = composed.read_text()
(a.out / 'composition.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True), text.splitlines(True), fromfile='a/src/route/fanout.ts', tofile='b/src/route/fanout.ts')))
runs = []
for label, source in sources.items():
    for repeat in range(1, 4):
        cmd = ['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '180', 'bun', 'test',
               'test/fanout-budget.test.ts', 'test/fanout-span.test.ts', 'test/fanout-contact.test.ts']
        result = subprocess.run(cmd, cwd=source, capture_output=True, text=True)
        log = result.stdout + result.stderr
        (a.out / f'{label}-{repeat}.log').write_text(log)
        passed = int(re.search(r'(\d+) pass', log)[1])
        failed = int(re.search(r'(\d+) fail', log)[1])
        expected = dict(main=(11, 8), budget=(13, 6), span=(13, 6), contact=(15, 4), composed=(19, 0))
        assert (passed, failed) == expected[label], log
        assert result.returncode == (0 if failed == 0 else 1), log
        runs.append(dict(version=label, repeat=repeat, passed=passed, failed=failed, log=log))
cmd = ['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '900', 'bash', '-c',
       'bun run typecheck && bun run check:layers && bun run test']
result = subprocess.run(cmd, cwd=sources['composed'], capture_output=True, text=True)
log = result.stdout + result.stderr
(a.out / 'composed-checks.log').write_text(log)
assert result.returncode == 0, log[-6000:]
summary = dict(refs=refs, tests={p: sha(d) for p,d in tests.items()},
               sources={label: sha((source/'src/route/fanout.ts').read_bytes()) for label,source in sources.items()},
               runs=runs, checks=dict(command=cmd, returncode=result.returncode, log_sha256=sha(log.encode()), tail=log[-700:]),
               scope='Synthetic integration only; no composed native score or performance claim.')
(a.out / 'composition.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k != 'runs'}, indent=2))
