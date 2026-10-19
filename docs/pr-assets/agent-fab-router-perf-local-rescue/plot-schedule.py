"""Render captured scheduler regression outcomes; not a route-speed benchmark."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
results=json.loads(Path(sys.argv[1]).read_text())
assert len(results['rows'])==5 and all(r['expected_outcome_observed'] for r in results['rows'])
out=Path(sys.argv[2])
if out.exists():raise SystemExit('output exists')
fig,ax=plt.subplots(figsize=(9,3.8))
labels=['Narrow region closure','Grown region closure','Expansion cap interrupted','Late legal closure']
ax.barh(labels,[1,1,1,1],color=['#e09c39','#35986c','#4473a2','#4473a2'])
for i,text in enumerate(['Rejected; copper restored','Kept; exact DRC clean','Rejected; copper restored','Rejected; copper restored']):
 ax.text(.03,i,text,va='center',color='white',weight='bold')
ax.invert_yaxis();ax.set_xlim(0,1.05);ax.set_xticks([])
ax.set_title('Research scheduler: region growth and shared budgets')
ax.spines[['top','right','bottom']].set_visible(False)
fig.text(.02,.015,'Regression controls only. Recorded path replay; no new route discovery or native improvement.',fontsize=9)
fig.tight_layout(rect=(0,.04,1,1));fig.savefig(out,dpi=170);plt.close(fig)
