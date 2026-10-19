from pathlib import Path
import json
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path(__file__).parent
native=json.loads((p/'native-measurements.json').read_text())['attempts']
extra=json.loads((p/'extra-summary.json').read_text())
cases=sorted({r['case'] for r in native})
ratios=[]
for c in cases:
 b,a=[median(x['seconds'] for x in native if x['case']==c and x['version']==v) for v in ['before','after']]
 ratios.append(b/a)
fig,(ax,bx)=plt.subplots(1,2,figsize=(15,10),gridspec_kw={'width_ratios':[2,1]})
ax.barh(cases,ratios,color=['#286b82' if x>=1 else '#bc684b' for x in ratios]); ax.axvline(1,color='#222',lw=1)
ax.set_xlabel('Baseline median / candidate median (3 repeats)');ax.invert_yaxis();ax.set_title('Native route timing — shared host')
labels=['0','1','2–4','5–8','9–16','17–32','33+'];bins=[0,0,0,0,0,0,0]
for key in ['box','sweep']:
 for i,n in enumerate(extra['census'][key]):
  j=0 if i==0 else 1 if i==1 else 2 if i<=4 else 3 if i<=8 else 4 if i<=16 else 5 if i<=32 else 6
  bins[j]+=n
bx.bar(labels,[x/1e6 for x in bins],color='#286b82');bx.set_xlabel('Returned references / query');bx.set_ylabel('Million queries');bx.set_title('Paperino diagnostic query census')
fig.suptitle('Trivial lattice sort experiment — output preserved; timings descriptive',fontsize=14)
fig.tight_layout();fig.savefig(p/'route-comparison.png',dpi=145)
