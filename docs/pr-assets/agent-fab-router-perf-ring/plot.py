"""Render paired full-suite timings; requires matplotlib."""
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root = Path(__file__).parent
rows = json.loads((root / 'cycle4-measurements.json').read_text())['attempts']
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
ax.set_title('Exact ring containment: shared-host native benchmark\n26 cases × 3 repeats per version; alternating version order by case')
ax.grid(axis='x', alpha=.2)
fig.tight_layout()
fig.savefig(root / 'native-speedup.png', dpi=160)
