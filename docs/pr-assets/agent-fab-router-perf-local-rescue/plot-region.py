"""Chart asserted region controls; not performance measurements."""
import json
from pathlib import Path
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
report_path, output = map(Path, sys.argv[1:])
assert not output.exists(), 'Output already exists'
r=json.loads(report_path.read_text())
assert r['control_repeats']==3 and len(r['rows'])==8
assert all(row['expected_outcome_observed'] for row in r['rows'])
fig,ax=plt.subplots(figsize=(9,4))
ax.bar(['Cap crosses region\nrejected + restored','Full copper fits region\nclosure kept'],[3,3],color=['#ba664b','#267f72'])
ax.set_ylim(0,3.5)
ax.set_yticks(range(4))
ax.set_ylabel('Verified outcomes / 3 normal-pipeline repeats')
ax.set_title('Local recovery checks the complete track width')
fig.text(.5,.02,'Real ten-pad stall fixture; same legal witness. Research gate only; no native completion or speed gain.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,1))
fig.savefig(output,dpi=160)
