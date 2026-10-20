"""Render measured synthetic copper and endpoint witnesses, in layout units."""
import json,sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon,Circle
from pathlib import Path
source,target=map(Path,sys.argv[1:]);assert not target.exists()
rows=json.loads(source.read_text())['rows']
fig,axes=plt.subplots(3,5,figsize=(19,11))
for i,mode in enumerate(('baseline','nearest','witness')):
 for j,name in enumerate(('solid','hole','concave','nearest-blocked','foreign')):
  row=next(r for r in rows if r['mode']==mode and r['name']==name and r['repeat']==1)
  ax=axes[i,j];l=row['layout'];pour=l['pours'][0]
  xy=lambda pts:[(p['x']/10000,p['y']/10000)for p in pts]
  ax.add_patch(Polygon(xy(pour['outline']),facecolor='#cfe8d9',edgecolor='#35825a'))
  for hole in pour['holes']:ax.add_patch(Polygon(xy(hole),facecolor='white',edgecolor='#35825a'))
  for fence in l['fences']:
   c=fence['shape']['c'];ax.add_patch(Circle((c['x']/10000,c['y']/10000),fence['shape']['r']/10000,color='#8c8c8c',alpha=.8))
  for pad in l['pads']:ax.add_patch(Circle((pad['at']['x']/10000,pad['at']['y']/10000),.03,color='#284b63'))
  for t in l['tracks']:
   x,y=zip(*xy(t['pts']));ax.plot(x,y,color='#bc442e',linewidth=2,label='Retained route')
  if row.get('endpoint'):
   at=row['endpoint']['at'];ax.scatter([at['x']/10000],[at['y']/10000],marker='x',color='#9e2499',s=65,zorder=5)
  ax.autoscale_view();ax.margins(.12);ax.set_aspect('equal');ax.grid(alpha=.2)
  ax.set_title(f"{mode} / {name}: {row['incomplete']} open")
  ax.set_xlabel('mm');ax.set_ylabel('mm')
fig.suptitle('Disposable multiple-witness attachment: measured retained copper\nGreen: filled copper; purple cross: nearest witness; gray: track keepout; red: retained new route')
fig.tight_layout(rect=(0,0,1,.92));fig.savefig(target,dpi=150,metadata={'Software':'pour-witness'})
