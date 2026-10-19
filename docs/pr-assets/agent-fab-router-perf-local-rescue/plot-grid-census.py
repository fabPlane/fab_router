"""Plot measured search exits and region coarsening, summed over three native seeds."""
import json
from pathlib import Path
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(sys.argv[1])
cases=json.loads((root/'grid-summary.json').read_text())
cases=[c for c in cases if c['searches']]
fig,axes=plt.subplots(1,2,figsize=(15,9),sharey=True)
y=list(range(len(cases)))
axes[0].barh(y,[100*c['coarsened']/c['regions'] if c['regions'] else 0 for c in cases],color='#39858e')
axes[1].barh(y,[100*c['exhausted']/c['searches'] for c in cases],color='#bd7744')
axes[0].set_yticks(y,[c['case'] for c in cases],fontsize=8)
for ax,title in zip(axes,['Requested grids coarsened by the cell cap','Searches exceeding their pop limit']):
    ax.set(xlim=(0,100),xlabel='Percent of observed calls',title=title)
    ax.grid(axis='x',alpha=.2)
axes[0].invert_yaxis()
fig.suptitle('Exact-control diagnostic: 26 native cases × 3 seeds\nAll 78 sessions and native quality metrics unchanged; no relaxation applied',fontsize=13)
fig.tight_layout();fig.savefig(root/'grid-census.png',dpi=160)
