"""Validate isolated replay evidence and render its comparison with both native schedules."""
from pathlib import Path
from statistics import median
import hashlib
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
capture_path = root / 'clearance-samples.json'
replay = json.loads((root / 'clearance-replay.json').read_text())
capture = json.loads(capture_path.read_text())
assert replay['capture_sha256'] == hashlib.sha256(capture_path.read_bytes()).hexdigest()
assert replay['harness_sha256'] == hashlib.sha256((root / 'replay-clearance.ts').read_bytes()).hexdigest()
assert capture['capture_harness_sha256'] == hashlib.sha256((root / 'capture-clearance.ts').read_bytes()).hexdigest()
assert capture['provenance']['generator_sha256'] == hashlib.sha256((root / 'capture-clearance.py').read_bytes()).hexdigest()
assert capture['ses_sha256'] == json.loads((root / 'capsule-trace.json').read_text())['ses_sha256']
assert not capture['report']['timedOut'] and not capture['report']['aborted']
trace = json.loads((root / 'capsule-trace.json').read_text())['counts']
counts = {key: row['seen'] for key, row in capture['groups'].items()}
assert counts.pop('fast-capsule') == trace['fast']
assert counts == trace['fallback']
assert sum(row['seen'] for row in capture['groups'].values()) == trace['total']
summary = {}
lines = ['| Workload | Baseline median / max s | Candidate median / max s | Baseline / candidate |', '|---|---:|---:|---:|']
rows = replay['rows']
assert len(rows) == 56
native = json.loads((root / 'cycle12-native-measurements.json').read_text())
for version in ['before', 'after']:
    control = next(iter(native['controls'][version].values()))
    assert replay['identities'][version]['commit'] == control['commit']
    assert all(replay['identities'][version]['sha256'][file] == digest
               for file, digest in control['source_sha256'].items())
previous_end = None
for row in rows:
    assert row['started_utc'] <= row['finished_utc']
    assert previous_end is None or previous_end <= row['started_utc']
    previous_end = row['finished_utc']
for group in ['fast-capsule', 'capsule/disk', 'disk/disk', 'disk/capsule']:
    summary[group] = {}
    for version in ['before', 'after']:
        selected = [r for r in rows if r['group'] == group and r['version'] == version]
        assert len(selected) == 7 and {r['repeat'] for r in selected} == set(range(7))
        assert all(r['warmup'] == (r['repeat'] == 0) for r in selected)
        assert all(r['calls'] == 5000000 for r in selected)
        for r in selected:
            other = next(x for x in rows if x['group'] == group and x['repeat'] == r['repeat'] and x['version'] != version)
            assert r['checksum'] == other['checksum']
        times = [r['seconds'] for r in selected if not r['warmup']]
        summary[group][version] = {'median': median(times), 'max': max(times), 'min': min(times)}
    b, a = (summary[group][v] for v in ['before', 'after'])
    lines.append(f"| {group} | {b['median']:.6f} / {b['max']:.6f} | {a['median']:.6f} / {a['max']:.6f} | {b['median']/a['median']:.3f}× |")
(root / 'replay-tables.md').write_text('\n'.join(lines) + '\n')
(root / 'replay-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
fig, (ax, bx) = plt.subplots(1, 2, figsize=(16, 10), gridspec_kw={'width_ratios': [3, 2]})
experiments = [json.loads((root / f'{label}-measurements.json').read_text())['attempts'] for label in ['native', 'cycle12-native']]
cases = sorted({r['case'] for r in experiments[0]})
for index, (label, attempts) in enumerate(zip(['Cycle 11', 'Cycle 12, reverse order'], experiments)):
    assert len(attempts) == 156
    ratios = []
    for case in cases:
        paired = [[r for r in attempts if r['case'] == case and r['version'] == v] for v in ['before', 'after']]
        assert all(len(group) == 3 for group in paired)
        assert all(b['ses_sha256'] == a['ses_sha256'] for b, a in zip(*[sorted(group, key=lambda r: r['seed']) for group in paired]))
        b, a = [median(r['seconds'] for r in group) for group in paired]
        ratios.append(b/a)
    ax.barh([i + (index - .5) * .36 for i in range(len(cases))], ratios, height=.34, label=label)
ax.set_yticks(range(len(cases)), cases)
ax.invert_yaxis()
ax.axvline(1, color='black', lw=1)
ax.set_xlabel('Baseline / candidate median route seconds')
ax.set_title('Full native: 26 cases × 3 repeats/version/schedule')
ax.legend()
for i, (group, versions) in enumerate(summary.items()):
    ratio = versions['before']['median'] / versions['after']['median']
    bx.bar(i, ratio, color='#318a68' if ratio >= 1 else '#bd5b4e')
    bx.text(i, ratio + .02, f'{ratio:.3f}×', ha='center')
bx.set_xticks(range(4), ['Capsule fast', 'Capsule/disk', 'Disk/disk', 'Disk/capsule'], rotation=25, ha='right')
bx.axhline(1, color='black', lw=1)
bx.set_ylabel('Baseline / candidate median replay seconds')
bx.set_title('5 million calls/repeat, 6 measured + excluded warmup\nSeparate processes; sampled real calls, grouped')
fig.suptitle('Direct capsule comparisons: isolated replay and native routing\nShared host; replay ratios do not predict whole-route speedups')
fig.tight_layout()
fig.savefig(root / 'replay-native-comparison.png', dpi=130)
print('\n'.join(lines))
