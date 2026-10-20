"""Original-context before/after geometry from captured live search; no witness input."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
r=json.loads(Path(sys.argv[1]).read_text());row=next(x for x in r['rows'] if x['context']=='original')
scale=row['luPerUm']*1000
out=Path(sys.argv[2]);assert not out.exists()
fig,axes=plt.subplots(1,2,figsize=(12,6))
for ax,after in zip(axes,[False,True]):
 for p in row['pads']:
  b=next(x.get('bounds') for x in p['boundsBySheet'] if x['sheet']==row['tracks'][-1]['sheet'])
  if not b:continue
  color='#df9d35' if p['net']==4 else '#c3cbd4'
  ax.add_patch(Rectangle((b['x0']/scale,b['y0']/scale),(b['x1']-b['x0'])/scale,(b['y1']-b['y0'])/scale,facecolor=color,edgecolor='#657080',linewidth=.4))
 for t in row['tracks']:
  # Journal appends the discovered connection after the existing short branch.
  if not after and t==row['tracks'][-1]:continue
  ax.plot([p['x']/scale for p in t['pts']],[p['y']/scale for p in t['pts']],color='#198168',linewidth=2)
 for p in row['pads']:
  if p['id'] in [10,62]:ax.annotate(str(p['id']),(p['at']['x']/scale,p['at']['y']/scale),xytext=(4,5),textcoords='offset points',fontsize=9)
 ax.set_xlim(98,153);ax.set_ylim(-107,-65);ax.set_aspect('equal');ax.set_xlabel('mm');ax.set_ylabel('mm');ax.grid(alpha=.12)
 ax.set_title(('After normal routing: 1 target link open','After visibility search: target net joined')[after])
fig.suptitle('Original 60-pad context: newly discovered full-width connection')
fig.text(.5,.02,'Copper projected across sheets. Three repeats, zero exact violations. Isolated target net; native safety unproven.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.04,1,.94));fig.savefig(out,dpi=160);plt.close(fig)
