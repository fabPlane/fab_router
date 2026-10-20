"""Plot complete measured native pairs; labels are neutral input aliases."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2]);assert not out.exists()
assert len(r['cases'])==26 and len(r['attempts'])==78 and not r['regressions']
fig,(ax,bx)=plt.subplots(2,1,figsize=(12,7.2),sharex=True)
x=list(range(26));colors=['#8491a2','#00856a']
for i,mode in enumerate(['before','after']):
 ax.bar([n+(i-.5)*.36 for n in x],[c[mode]['opens']for c in r['cases']],width=.36,color=colors[i],label=['Normal','Explicit research adapter'][i])
 bx.plot(x,[c[mode]['median_s']for c in r['cases']],marker='o',markersize=3,color=colors[i],label=['Normal','Explicit research adapter'][i])
ax.set_ylabel('Native opens, 3 repeats summed');ax.legend(frameon=False);ax.grid(axis='y',alpha=.15)
bx.set_ylabel('Median route seconds');bx.set_yscale('log');bx.grid(axis='y',alpha=.15)
bx.set_xticks(x,[f'C{i+1:02}' for i in x],rotation=60);bx.set_xlabel('Frozen case aliases (full input ids in paired JSON)')
a,b=r['summary']['before'],r['summary']['after']
fig.suptitle(f"Shared-deadline recovery: native opens {a['opens']} → {b['opens']}; passes {a['passed']}/78 → {b['passed']}/78")
fig.text(.5,.025,f"26 cases × 3 repeats, same host/cores. Native errors {a['new_errors']} → {b['new_errors']} remain unresolved. Shared-host timings; no speed claim.",ha='center',fontsize=9)
fig.tight_layout(rect=(0,.05,1,.94));fig.savefig(out,dpi=160);plt.close(fig)
