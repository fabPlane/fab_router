"""Compare all interleaved experiments; run with matplotlib installed."""
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).parent
experiments = [json.loads((root / 'measurements.json').read_text())['interleaved_native'],
               json.loads((root / 'cycle2-measurements.json').read_text())['attempts'],
               json.loads((root / 'cycle3-measurements.json').read_text())['attempts']]
cases = sorted({r['case'] for r in experiments[0]})
fig, ax = plt.subplots(figsize=(12, 11))
for index, (rows, color) in enumerate(zip(experiments, ['#6689b5', '#177c88', '#c16b31'])):
    ratios = []
    for case in cases:
        b, a = (median(r['seconds'] for r in rows if r['case'] == case and r['version'] == v)
                for v in ['before', 'after'])
        ratios.append(b / a)
    label = f'Interleaved experiment {index + 1}' if index < 2 else 'Experiment 3: reversed order'
    ax.barh([y + (index - 1) * .25 for y in range(len(cases))], ratios,
            height=.24, color=color, label=label)
ax.axvline(1, color='#333333', linewidth=1)
ax.set_yticks(range(len(cases)), cases)
ax.invert_yaxis()
ax.set_xlabel('Baseline median / candidate median (higher is faster)')
ax.set_title('Rim containment: repeated timing measurements on shared host\n'
             '26 cases × 3 repeats per version per experiment; unchanged paired SES and quality')
ax.legend(loc='upper center', bbox_to_anchor=(.5, -.065), ncol=3, fontsize=9)
ax.grid(axis='x', alpha=.2)
fig.tight_layout()
fig.savefig(root / 'reverse-order-speedup.png', dpi=160)
