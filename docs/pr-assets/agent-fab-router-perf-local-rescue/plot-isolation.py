"""Plot measured engine context isolation, no performance comparison implied."""
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.loads(Path(sys.argv[1]).read_text())
modes=list(dict.fromkeys(x['mode'] for x in r['rows']))
fig,ax=plt.subplots(figsize=(11,5))
for i,mode in enumerate(modes):
 rows=[x for x in r['rows'] if x['mode']==mode]
 ax.scatter([i]*len(rows),[len(x['after']) for x in rows],s=140,alpha=.5)
 ax.annotate(f"{sum(not x['after'] for x in rows)}/3 target nets completed",(i,max(len(x['after']) for x in rows)+.08),ha='center',fontsize=9)
ax.set_xticks(range(len(modes)),[x.replace('target-','').replace('-','\n') for x in modes])
ax.set_xlim(-.65,len(modes)-.35)
ax.set_ylabel('Remaining target-net connections')
ax.set_ylim(-.15,max(len(x['after']) for x in r['rows'])+.6)
ax.set_title('Endpoint context isolation: three identical seed-1 repeats per intervention')
fig.text(.5,.01,'Engine-only diagnostic; no native DRC, repair, speedup or physical impossibility claim.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.04,1,1));fig.savefig(sys.argv[2],dpi=150)
