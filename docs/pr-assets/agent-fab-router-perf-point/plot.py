"""Render complete native and captured-call measurements; retain adverse results."""
from pathlib import Path
import json
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root = Path(__file__).resolve().parent
native = json.loads((root/'native-measurements.json').read_text())['attempts']
replay = json.loads((root/'clearance-replay.json').read_text())
fig, (a,b) = plt.subplots(1,2,figsize=(16,10),gridspec_kw={'width_ratios':[3,1]})
cases = sorted({r['case'] for r in native})
ratios = []
for case in cases:
    before,after = [median(r['seconds'] for r in native if r['case']==case and r['version']==v) for v in ['before','after']]
    ratios.append(before/after)
a.barh(cases,ratios,color=['#318a68' if x>=1 else '#bd5b4e' for x in ratios])
a.invert_yaxis();a.axvline(1,color='black',lw=1)
a.set_title('Native routing: 26 cases × 3 repeats/version')
a.set_xlabel('Baseline / candidate median seconds (shared host)')
groups = sorted({r['group'] for r in replay['rows']})
ratios=[]
for group in groups:
    before,after=[median(r['seconds'] for r in replay['rows'] if r['group']==group and r['version']==v and not r['warmup']) for v in ['before','after']]
    ratios.append(before/after)
b.barh(groups,ratios,color=['#318a68' if x>=1 else '#bd5b4e' for x in ratios])
b.invert_yaxis();b.axvline(1,color='black',lw=1)
b.set_title('Isolated captured-call replay')
b.set_xlabel('Baseline / candidate median seconds')
fig.suptitle('Direct point clearance experiment: full routing and grouped call replay')
fig.text(.5,.015,'Replay: 5 million calls × 6 repeats + excluded warmup; sample groups are not route-weighted. Native failures retained.',ha='center',fontsize=9)
fig.tight_layout(rect=[0,.04,1,.96]);fig.savefig(root/'route-comparison.png',dpi=150)
