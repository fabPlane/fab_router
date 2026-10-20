"""Plot asserted retained-copper controls; not routing performance measurements."""
import json
from pathlib import Path
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

report_path, output = map(Path, sys.argv[1:])
assert not output.exists(), 'Output already exists'
report = json.loads(report_path.read_text())
assert report['control_repeats'] == 3
assert len(report['rows']) == 5
assert all(r['expected_outcome_observed'] for r in report['rows'])
fig, ax = plt.subplots(figsize=(8, 4))
ax.bar(['file', 'session', 'prior'], [3, 3, 3], color='#267f72')
ax.set_ylim(0, 3.6)
ax.set_yticks([0, 1, 2, 3])
ax.set_ylabel('Rejected and restored proposals / 3 repeats')
ax.set_xlabel('Retained track origin')
ax.set_title('Retained-copper removal is rejected despite legal closure')
fig.text(.5, .02, 'Real ten-pad fixture; redundant branch removal + legal witness. No native safety or speed claim.', ha='center', fontsize=8)
fig.tight_layout(rect=(0, .05, 1, 1))
fig.savefig(output, dpi=160)
