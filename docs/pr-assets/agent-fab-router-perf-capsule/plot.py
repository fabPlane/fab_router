"""Render all native case medians and the larger-board comparison; no failed cases omitted."""
from pathlib import Path
from statistics import median
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent
rows=json.loads((root/'native-measurements.json').read_text())['attempts']
cases=sorted({r['case'] for r in rows})
ratios=[]
for case in cases:
 b,a=[median(r['seconds'] for r in rows if r['case']==case and r['version']==v) for v in ['before','after']]
 ratios.append(b/a)
extra=json.loads((root/'extra-summary.json').read_text())
fig,(ax,bx)=plt.subplots(1,2,figsize=(15,10),gridspec_kw={'width_ratios':[3,1]})
ax.barh(cases,ratios,color=['#318a68' if x>=1 else '#bd5b4e' for x in ratios]);ax.axvline(1,color='black',lw=1)
ax.invert_yaxis();ax.set_xlabel('Baseline / candidate median route seconds');ax.set_title('26 frozen cases × 3 repeats per version (all attempts)')
labels=['L1','L2','Paperino\nCPU-profiled'];ratios=[]
for key in ['l1.dsn','l2.dsn']:
 d=extra['ladder'][key];ratios.append(d['before']['median_seconds']/d['after']['median_seconds'])
d=extra['profiles'];ratios.append(d['before']['median_seconds']/d['after']['median_seconds'])
bx.bar(labels,ratios,color=['#318a68' if x>=1 else '#bd5b4e' for x in ratios]);bx.axhline(1,color='black',lw=1)
bx.set_ylabel('Baseline / candidate median seconds');bx.set_title('3 repeats per version')
for i,r in enumerate(ratios):bx.text(i,r+0.02,f'{r:.3f}×',ha='center')
fig.suptitle('Direct capsule clearance experiment — shared host; timings include existing failures')
fig.tight_layout();fig.savefig(root/'route-comparison.png',dpi=130)
