"""Render committed measurements: python3 -m pip install matplotlib; python3 plot.py."""
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root = Path(__file__).parent
rows = json.loads((root / 'measurements.json').read_text())['interleaved_native']
cases = sorted({r['case'] for r in rows})
ratios = []
for case in cases:
    times = {v: median(r['seconds'] for r in rows if r['case'] == case and r['version'] == v) for v in ['before', 'after']}
    ratios.append(times['before'] / times['after'])
fig, ax = plt.subplots(figsize=(11, 10))
ax.barh(cases, ratios, color=['#177c88' if x >= 1 else '#c6574e' for x in ratios])
ax.axvline(1, color='#333333', linewidth=1)
ax.set_xlabel('Baseline median / candidate median (higher is faster)')
ax.set_title('Rim containment: interleaved native checks\n26 cases × 3 repeats per version; all outcomes and SES bytes unchanged')
ax.invert_yaxis()
ax.grid(axis='x', alpha=.2)
for y, ratio in enumerate(ratios):
    ax.text(ratio + .015, y, f'{ratio:.2f}×', va='center', fontsize=9)
ax.set_xlim(0, max(1.15, max(ratios) + .2))
fig.tight_layout()
fig.savefig(root / 'native-speedup.png', dpi=160)
