"""Summarize isolated query shapes; exclude repeat zero, plot all measured repeats."""
import argparse
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
fig, ax = plt.subplots(figsize=(9, 5))
lines = ['| Workload | Before median s | Rejected candidate median s | Ratio before/after |',
         '|---|---:|---:|---:|']
identity = None
box_result = None
for i, kind in enumerate(['box-plain', 'box-dop8', 'sweep']):
    report = json.loads((args.directory / f'cycle7-{kind}.json').read_text())
    assert report['kind'] == kind
    current = {k: report[k] for k in ['slotSha256', 'boxQueriesSha256', 'callsPerRow', 'sources', 'allowedCpus', 'bun']}
    if identity is None: identity = current
    assert identity == current, 'Workload or source identity changed'
    if kind == 'box-plain': box_result = report['orderedResultsSha256']
    if kind == 'box-dop8': assert box_result == report['orderedResultsSha256']
    assert len(report['rows']) == 14
    assert {r['repeat'] for r in report['rows']} == set(range(7))
    assert len({r['checksum'] for r in report['rows']}) == 1
    medians = []
    for version, offset, color in [('before', -.15, '#396ab1'), ('after', .15, '#da7c30')]:
        rows = [r for r in report['rows'] if r['version'] == version and r['repeat'] != 0]
        assert len(rows) == 6
        values = [r['seconds'] for r in rows]
        m = median(values)
        medians.append(m)
        ax.bar(i + offset, m, width=.28, color=color, alpha=.6,
               label=('baseline' if version == 'before' else 'rejected candidate') if i == 0 else None)
        ax.scatter([i + offset] * len(values), values, color=color, s=15, zorder=3)
    lines.append(f'| {kind} | {medians[0]:.6f} | {medians[1]:.6f} | {medians[0]/medians[1]:.3f}× |')
ax.set_xticks(range(3), ['Plain Box', 'Box via Dop8', 'Sweep via Dop8'])
ax.set_ylabel('Seconds per ten million queries (lower is better)')
ax.set_title('Rejected collector: isolated query object shapes\nSix measured repeats + excluded warmup; dots show every repeat')
ax.legend()
fig.tight_layout()
fig.savefig(args.directory / 'query-shapes.png', dpi=160)
(args.directory / 'query-shapes-table.md').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
