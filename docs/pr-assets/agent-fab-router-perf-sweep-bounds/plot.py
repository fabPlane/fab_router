"""Render all native case medians and the larger/profiled workloads from verified summaries."""
from pathlib import Path
import json,statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path(__file__).resolve().parent
rows=json.loads((p/'native-measurements.json').read_text())['attempts']
extra=json.loads((p/'extra-summary.json').read_text())
cases=sorted({r['case'] for r in rows})
before=[statistics.median(r['seconds'] for r in rows if r['case']==c and r['version']=='before') for c in cases]
after=[statistics.median(r['seconds'] for r in rows if r['case']==c and r['version']=='after') for c in cases]
fig,(ax,bx)=plt.subplots(1,2,figsize=(16,10),gridspec_kw={'width_ratios':[2,1]})
y=list(range(len(cases)))
ax.barh([i-.18 for i in y],before,.36,label='main 69cf598',color='#516b83')
ax.barh([i+.18 for i in y],after,.36,label='two-endpoint candidate',color='#d48337')
ax.set_yticks(y,cases,fontsize=8);ax.invert_yaxis();ax.set_xscale('log');ax.set_xlabel('Route seconds (log scale; median of 3)');ax.legend()
labels=['L1: fixed 2 passes','L2: fixed 2 passes','Paperino: CPU profiled']
bs=[extra['ladder'][f]['before']['median_seconds'] for f in ['l1.dsn','l2.dsn']]+[extra['profiles']['before']['median_seconds']]
as_=[extra['ladder'][f]['after']['median_seconds'] for f in ['l1.dsn','l2.dsn']]+[extra['profiles']['after']['median_seconds']]
ratios=[a/b for a,b in zip(as_,bs)]
bx.barh(labels,ratios,color=['#b05248' if r>=1 else '#407d67' for r in ratios]);bx.axvline(1,color='black',lw=1);bx.invert_yaxis();bx.set_xlabel('Candidate / baseline median time\nLower is faster; 3 repeats/version')
for i,r in enumerate(ratios):bx.text(r+.01,i,f'{r:.3f}x',va='center')
bx.set_xlim(0,max(1.15,max(ratios)+.15));bx.set_title('Additional routing workloads')
fig.suptitle('Two-endpoint sweep bounds: measured route times on hyper-ms-lin\nSame inputs/settings, cores 12–19; shared-host timings',fontsize=14)
fig.text(.5,.015,'Native: 26 cases x 3 repeats/version. All 78 paired sessions and quality outcomes match. Router counters on ladder boards are not native DRC.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.035,1,.94));fig.savefig(p/'route-comparison.png',dpi=140);plt.close(fig)
