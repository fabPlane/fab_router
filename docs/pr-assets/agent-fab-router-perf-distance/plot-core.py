"""Render exact shape counts and systematic caller samples from distance-trace.json."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).parent
data=json.loads((root/'distance-trace.json').read_text())
fig,axes=plt.subplots(1,2,figsize=(12,4.5))
kinds=data['kinds']
axes[0].bar(list(kinds),[v['calls']/1e6 for v in kinds.values()],color='#177c88')
axes[0].set_ylabel('Exact coreOf calls, millions')
axes[0].set_title(f"{data['coreCalls']:,} coreOf calls; {data['dist2Calls']} dist2 calls")
callers={}
for key,value in data['sampledCallers'].items():
 name=key.split('/src/')[-1].split(':')[0]
 callers[name]=callers.get(name,0)+value
axes[1].barh(list(callers),list(callers.values()),color='#177c88')
axes[1].set_xlabel('Systematic samples (one per 4,096 coreOf calls)')
axes[1].set_title('Caller mix is sampled, not an exact count')
fig.suptitle('Paperino baseline allocation diagnosis — instrumented timing excluded')
fig.tight_layout()
fig.savefig(root/'core-call-mix.png',dpi=160)
