import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
assets=Path(__file__).resolve().parent
rows=json.loads((assets/'insertion-results.json').read_text())
fig,ax=plt.subplots(figsize=(12,6))
labels=[r['case'].split('-')[0]+' '+r['net'] for r in rows]
y=list(range(len(rows)))
ax.barh(y,[r['stages'].get('trail-legalise-rejected',0) for r in rows],label='Rejected trail legalisation')
ax.barh(y,[r['stages'].get('trail-legalised',0) for r in rows],left=[r['stages'].get('trail-legalise-rejected',0) for r in rows],label='Legalised trial legs (may be rolled back)')
ax.set_yticks(y,labels);ax.invert_yaxis();ax.set_xlabel('Calls attributed to residual routeConnection, including neighbour reroutes')
ax.set_title('All nine residual connections remain open; final sessions unchanged')
ax.legend();fig.tight_layout();fig.savefig(sys.argv[1],dpi=150)
