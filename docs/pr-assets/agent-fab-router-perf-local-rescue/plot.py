"""Plot measured fixture copper and per-case native routing times."""
import json,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle,Polygon,Rectangle
root=Path(__file__).resolve().parent
fixture=json.loads((root/'fixture.json').read_text())
fig,axes=plt.subplots(1,2,figsize=(11,5))
colors=['#1678b8','#d96e20']
for ax,v,title,drc in zip(axes,['before','after'],['Before local repair','After local repair'],[fixture['baselineDrc'],fixture['afterDrc']]):
 board=fixture[v]
 for t in board['tracks']:
  pts=[(p['x']/10000,p['y']/10000) for p in t['pts']];r=t['width']/20000;c=colors[t['net']]
  for x,y in pts:ax.add_patch(Circle((x,y),r,color=c,alpha=.85))
  for (x,y),(xx,yy) in zip(pts,pts[1:]):
   length=math.hypot(xx-x,yy-y)
   if not length:continue
   dx=(yy-y)/length*r;dy=-(xx-x)/length*r
   ax.add_patch(Polygon([(x+dx,y+dy),(xx+dx,yy+dy),(xx-dx,yy-dy),(x-dx,y-dy)],color=c,alpha=.85))
 for pad in board['pads']:
  x,y=pad['at']['x']/10000,pad['at']['y']/10000
  ax.add_patch(Rectangle((x-.2,y-.2),.4,.4,facecolor=colors[pad['net']],edgecolor='#25303b',zorder=5))
 ax.set(xlim=(-3.5,3.5),ylim=(-3.5,3.5),xlabel='mm',ylabel='mm',title=f"{title}\n{drc['counts']['incompletes']} incomplete; {drc['counts']['violations']} exact-rule violations")
 ax.set_aspect('equal');ax.grid(alpha=.15)
fig.suptitle('Measured transactional repair fixture: unchanged width and clearance\nUnit-stage illustration; normal routing also completes this fixture',fontsize=12)
fig.tight_layout();fig.savefig(root/'local-repair.png',dpi=180);plt.close(fig)
if (root/'native-measurements.json').exists():
 data=json.loads((root/'native-measurements.json').read_text())
 from statistics import median
 cases=data['schedule']['cases'];fig,ax=plt.subplots(figsize=(12,10));y=list(range(len(cases)))
 for offset,v,c in [(-.18,'before','#617788'),(.18,'after','#278c96')]:
  times=[median(r['seconds'] for r in data['attempts'] if r['case']==case and r['version']==v) for case in cases]
  ax.barh([k+offset for k in y],times,height=.34,label=v,color=c)
 ax.set_yticks(y,[c.replace('fan-controller-fan-controller','fan-controller').replace('nextbusclock-nextbusclockv1','nextbusclock') for c in cases]);ax.invert_yaxis();ax.set_xlabel('Median route pipeline seconds (3 repeats; shared host)');ax.legend();ax.grid(axis='x',alpha=.2)
 ax.set_title('Local track rescue experiment — native-checked suite')
 fig.tight_layout();fig.savefig(root/'native-times.png',dpi=160);plt.close(fig)
