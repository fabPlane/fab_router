"""Verify and summarize a complete paired-native.py run, including failed boards."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path
from statistics import median

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('run', type=Path)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--label', default='native', help='Prefix for generated evidence files')
args = parser.parse_args()
assert args.label and all(c.isalnum() or c in '-_' for c in args.label)
rows = []
controls = {}
identity = None
timings = {}
schedule_path = args.run / 'schedule.json'
schedule = json.loads(schedule_path.read_text()) if schedule_path.exists() else None
for version in ['before', 'after']:
    directories = sorted(p for p in (args.run / version).iterdir() if p.is_dir())
    assert len(directories) == 26, (version, len(directories))
    controls[version] = {}
    for directory in directories:
        assert json.loads((directory / 'summary.json').read_text())['complete']
        control = json.loads((directory / 'controls.json').read_text())
        current_identity = {k: control[k] for k in ['version', 'inputs_sha256', 'harness_sha256', 'runtime_sha256', 'allowed_cpus', 'configs_sha256']}
        if identity is None:
            identity = current_identity
        assert identity == current_identity, (version, directory.name, 'benchmark identity changed')
        candidate = control['candidate']
        if controls[version]:
            assert candidate == next(iter(controls[version].values())), (version, directory.name, 'source identity changed within version')
        for path, expected in candidate['source_sha256'].items():
            content = subprocess.check_output(['git', '-C', candidate['path'], 'show', f"{candidate['commit']}:{path}"])
            assert hashlib.sha256(content).hexdigest() == expected, (version, path, 'source differs from commit')
        controls[version][directory.name] = candidate
        timings[(version, directory.name)] = tuple(datetime.fromisoformat(control[k])
                                                  for k in ['utc_start', 'utc_end'])
        attempts = json.loads((directory / 'results.json').read_text())
        assert len(attempts) == 3
        assert {r['seed'] for r in attempts} == {1, 2, 3}
        for attempt in attempts:
            assert attempt['case'] == directory.name
            row = {k: attempt[k] for k in ['case', 'seed', 'seconds', 'passed', 'opens',
                   'new_errors', 'vias', 'length_mm', 'new_error_types', 'failed_fidelity']}
            row['version'] = version
            row['ses_sha256'] = hashlib.sha256(
                (directory / attempt['evidence'] / 'work/board.ses').read_bytes()).hexdigest()
            rows.append(row)
if schedule is not None:
    assert sorted(controls['before']) == schedule['cases'] == sorted(controls['after'])
    previous_end = None
    for index, case in enumerate(schedule['cases']):
        order = ['before', 'after'] if (index % 2 == 0) != schedule['reverse_order'] else ['after', 'before']
        for version in order:
            assert controls[version][case]['path'] == schedule[
                'baseline_source' if version == 'before' else 'candidate_source']
            start, end = timings[(version, case)]
            assert start <= end
            assert previous_end is None or previous_end <= start, (case, version, 'schedule order differs')
            previous_end = end
before = {(r['case'], r['seed']): r for r in rows if r['version'] == 'before'}
after = {(r['case'], r['seed']): r for r in rows if r['version'] == 'after'}
assert before.keys() == after.keys()
for key in before:
    for field in ['passed', 'opens', 'new_errors', 'vias', 'length_mm',
                  'new_error_types', 'failed_fidelity', 'ses_sha256']:
        assert before[key][field] == after[key][field], (key, field)
args.out.mkdir(parents=True, exist_ok=True)
(args.out / f'{args.label}-measurements.json').write_text(json.dumps(
    {'host': 'hyper-ms-lin', 'cpus': '12-19', 'benchmark_identity': identity,
     'schedule': schedule,
     'run_windows': {v: {case: [t.isoformat() for t in timings[(v, case)]]
                         for case in sorted(controls[v])} for v in controls},
     'controls': controls, 'attempts': rows}, indent=2) + '\n')
lines = ['All 78 paired SES hashes and quality outcomes match.', '',
         '| Case | Before median / p95 s | After median / p95 s | Median ratio (control) | Passed (both) | Opens / errors (both) |',
         '|---|---:|---:|---:|---:|---:|']
totals = {v: 0.0 for v in ['before', 'after']}
for case in sorted({r['case'] for r in rows}):
    b, a = ([r for r in rows if r['case'] == case and r['version'] == v] for v in ['before', 'after'])
    bm, am = (median(r['seconds'] for r in group) for group in [b, a])
    totals['before'] += bm
    totals['after'] += am
    lines.append(f"| {case} | {bm:.3f} / {max(r['seconds'] for r in b):.3f} | "
                 f"{am:.3f} / {max(r['seconds'] for r in a):.3f} | {bm/am:.2f}× | "
                 f"{sum(r['passed'] for r in b)}/3 | {sum(r['opens'] for r in b)} / {sum(r['new_errors'] for r in b)} |")
lines.extend(['', f"Sum of case medians: {totals['before']:.3f} → {totals['after']:.3f} seconds."])
for version in ['before', 'after']:
    group = [r for r in rows if r['version'] == version]
    lines.append(f"{version}: total {sum(r['seconds'] for r in group):.3f}s; "
                 f"{sum(r['passed'] for r in group)}/78 passed; "
                 f"{sum(r['opens'] for r in group)} opens; {sum(r['new_errors'] for r in group)} new native errors.")
(args.out / f'{args.label}-tables.md').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
