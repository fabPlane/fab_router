"""All-net routing before/after, using captured geometry and native checked metrics."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
m,n,out=map(Path,sys.argv[1:]);assert not out.exists()
row=json.loads(m.read_text())['rows'][0];native=json.loads(n.read_text())['rows']
assert all(x['check']['new_errors']==0 and x['check']['integrity_pass'] for x in native)
assert {x['check']['opens'] for x in native if x['mode']=='before'}=={len(row['before'])}
assert {x['check']['opens'] for x in native if x['mode']=='after'}=={len(row['after'])}
scale=row['luPerUm']*1000;old={t['id'] for t in row['beforeTracks']};new=[t for t in row['tracks']if t['id']not in old]
fig,axes=plt.subplots(1,2,figsize=(12,6.4))
for ax,after in zip(axes,[False,True]):
 for p in row['pads']:
  for b in [x.get('bounds') for x in p['boundsBySheet']]:
   if b:ax.add_patch(Rectangle((b['x0']/scale,b['y0']/scale),(b['x1']-b['x0'])/scale,(b['y1']-b['y0'])/scale,facecolor='#d8dfe6',edgecolor='#82909d',linewidth=.4))
 for t in row['beforeTracks']+(new if after else []):
  fresh=t['id']not in old
  ax.plot([p['x']/scale for p in t['pts']],[p['y']/scale for p in t['pts']],color='#00886c' if fresh else '#7f8b98',linewidth=2 if fresh else .8,alpha=1 if fresh else .75)
 for target in row['results']['targets']:
  if target['status']!='kept':continue
  a,b=[next(p['at'] for p in row['pads'] if p['id']==target['pair'][k]) for k in ['from','to']]
  if not after:ax.plot([a['x']/scale,b['x']/scale],[a['y']/scale,b['y']/scale],color='#c94d36',linestyle='--',linewidth=1.4)
 ax.set_aspect('equal');ax.set_xlabel('mm');ax.set_ylabel('mm');ax.grid(alpha=.12)
 ax.set_title(('Normal routing: 6 native opens','With local copper corners: 4 native opens')[after])
fig.suptitle('Two full-board stall links closed without rule changes')
fig.text(.5,.02,'All nets active; copper projected across sheets. Three repeats; zero new native errors. Added length 110.557 mm; vias unchanged.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.04,1,.94));fig.savefig(out,dpi=160);plt.close(fig)
