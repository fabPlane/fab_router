"""Audit three repeated Issue026 slow-acceptance comparisons without relaxing failures.

Usage: python3 slow-audit.py /path/to/c30 > slow-acceptance.json
Run the existing acceptance CLI with --tier slow --case 'routing-slow-issue026-*'
--report <directory>/slow-{before,after}[-2,-3].json in each source checkout.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
run = Path(sys.argv[1])
records = []
reference = None
for version in ['before', 'after']:
    for repeat in range(1, 4):
        stem = f'slow-{version}' + (f'-{repeat}' if repeat > 1 else '')
        path = run / f'{stem}.json'
        report = json.loads(path.read_text())
        assert not report['acceptStubs'] and not report['invalidCases']
        assert report['summary'] == dict(total=2, passed=1, failed=1, advisory=0, stubbed=0)
        cases = report['cases']
        assert [c['id'] for c in cases] == [
            'routing-slow-issue026-j2-novia', 'routing-slow-issue026-j2-p1-optimizer-limits']
        assert [c['pass'] for c in cases] == [False, True]
        assert [c['measured']['incomplete'] for c in cases] == [12, 6]
        assert all(c['measured']['violationsAdded'] == 0 for c in cases)
        assert all(not c['measured']['timedOut'] and not c['measured']['aborted'] for c in cases)
        stable = [{k: v for k, v in c['measured'].items() if k != 'wallClockMs'} for c in cases]
        if reference is None:
            reference = stable
        assert stable == reference, (version, repeat, 'non-timing metrics changed')
        records.append(dict(version=version, repeat=repeat,
                            report_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                            log_sha256=hashlib.sha256((run / f'{stem}.log').read_bytes()).hexdigest(),
                            cases=cases))
identities = {}
for directory in ['src', 'spec', 'tools/acceptance']:
    files = subprocess.check_output(['git', 'ls-files', '-z', directory], cwd=root, text=True).rstrip('\0').split('\0')
    for file in files:
        expected = subprocess.check_output(['git', 'show', f'1bbd5f3:{file}'], cwd=root)
        actual = (root / file).read_bytes()
        assert expected == actual, file
        if directory != 'src':
            baseline = run / 'baseline' / file
            assert baseline.read_bytes() == actual, file
        identities.update({file: hashlib.sha256(actual).hexdigest()})
print(json.dumps(dict(source_commit='1bbd5f3', baseline_commit='69cf598', cores='20-25',
    native_drc=False, full_slow_tier=False, repeats_each=3,
    finding='Pre-existing no-via acceptance failure, 12 opens versus maximum 6; unchanged by pad attachment.',
    source_and_case_hashes=identities, records=records), indent=2))
