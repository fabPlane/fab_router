"""Render asserted real-fixture terminal states as a connectivity schematic."""
import json
import pathlib
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

results, output = map(pathlib.Path, sys.argv[1:])
assert not output.exists(), 'Output already exists'
report = json.loads(results.read_text())
assert report['control_repeats'] == 3
assert len(report['rows']) == 4 and all(r['expected_outcome_observed'] for r in report['rows'])
states = [
    ('Before trial', [(0, 1)], '1 open; 9–10 joined'),
    ('Rejected rip-up proposal', [(1, 2)], '1 open; 9 disconnected'),
    ('After rejection + rewind', [(0, 1)], '1 open; original branch restored'),
    ('Accepted legal witness', [(0, 1), (1, 2)], '0 opens; all terminals joined'),
]
fig, axes = plt.subplots(4, 1, figsize=(10, 6.4))
for ax, (title, edges, detail) in zip(axes, states):
    for a, b in edges:
        ax.plot([a, b], [0, 0], color='#267f72', linewidth=5, zorder=1)
    ax.scatter([0, 1, 2], [0, 0, 0], s=600, color='#253c5c', zorder=2)
    for i, terminal in enumerate([9, 10, 62]):
        ax.text(i, 0, str(terminal), ha='center', va='center', color='white', fontsize=12)
    ax.set_title(title + ' — ' + detail, loc='left', fontsize=11)
    ax.set_xlim(-.2, 2.2)
    ax.set_ylim(-.3, .3)
    ax.axis('off')
fig.suptitle('Equal open counts can hide a disconnected terminal', fontsize=16)
fig.text(.5, .015, 'Connectivity schematic only; not copper geometry. Asserted on the real fixture in three repeats.', ha='center', fontsize=10)
fig.tight_layout(rect=(0, .04, 1, .95))
fig.savefig(output, dpi=160)
