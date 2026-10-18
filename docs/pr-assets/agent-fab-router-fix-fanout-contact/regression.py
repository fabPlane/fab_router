#!/usr/bin/env python3
"""Repeat the unchanged regression suite on main and this checkout; keep all logs."""
import argparse, hashlib, io, json, re, subprocess, tarfile
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--out', type=Path, required=True)
p.add_argument('--before', default='69cf598')
a = p.parse_args()
root = Path(__file__).resolve().parents[3]
a.out.mkdir(parents=True, exist_ok=False)
base = a.out / 'before-source'
base.mkdir()
archive = subprocess.check_output(['git', 'archive', a.before], cwd=root)
with tarfile.open(fileobj=io.BytesIO(archive)) as t:
    t.extractall(base, filter='data')
fixture = root / 'test/fanout-contact.test.ts'
(base / 'test/fanout-contact.test.ts').write_bytes(fixture.read_bytes())
runs = []
for label, source in [('before', base), ('after', root)]:
    for repeat in range(1, 4):
        cmd = ['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '120', 'bun', 'test', 'test/fanout-contact.test.ts']
        r = subprocess.run(cmd, cwd=source, capture_output=True, text=True)
        log = r.stdout + r.stderr
        (a.out / f'{label}-{repeat}.log').write_text(log)
        passed = int(re.search(r'(\d+) pass', log)[1])
        failed = int(re.search(r'(\d+) fail', log)[1])
        assert (passed, failed, r.returncode) == ((2, 4, 1) if label == 'before' else (6, 0, 0)), log
        runs.append(dict(version=label, repeat=repeat, passed=passed, failed=failed))
summary = dict(before=a.before, after_source_sha256=hashlib.sha256((root/'src/route/fanout.ts').read_bytes()).hexdigest(), test_sha256=hashlib.sha256(fixture.read_bytes()).hexdigest(), runs=runs, scope='Synthetic fanout regression, not native task scores; Offset copper trials retain no disconnected vias or stubs; centered and overlapping copper controls preserve contacting vias.')
(a.out / 'regressions.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary, indent=2))
