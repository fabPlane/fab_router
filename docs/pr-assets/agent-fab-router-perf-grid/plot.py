"""Render paired full-suite timings; requires matplotlib."""
import argparse
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root = Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--label', default='cycle6')
parser.add_argument('--output', default='native-speedup.png')
parser.add_argument('--measurements', type=Path)
args = parser.parse_args()
assert args.label and all(c.isalnum() or c in '-_' for c in args.label)
measurement = json.loads((args.measurements or (root / f'{args.label}-measurements.json')).read_text())
rows = measurement['attempts']
order = 'reversed version order by case' if measurement['schedule']['reverse_order'] else 'alternating version order by case'
cases = sorted({r['case'] for r in rows})
ratios = []
for case in cases:
    b, a = (median(r['seconds'] for r in rows if r['case'] == case and r['version'] == v)
            for v in ['before', 'after'])
    ratios.append(b / a)
fig, ax = plt.subplots(figsize=(12, 10))
ax.barh(cases, ratios, color=['#177c88' if r >= 1 else '#b5683f' for r in ratios])
ax.axvline(1, color='#333333', linewidth=1)
ax.invert_yaxis()
ax.set_xlabel('Baseline median / candidate median (higher is faster)')
ax.set_title(f'Rejected lattice collection experiment: shared-host native benchmark\n26 cases × 3 repeats per version; {order}')
ax.grid(axis='x', alpha=.2)
fig.tight_layout()
fig.savefig(root / args.output, dpi=160)
