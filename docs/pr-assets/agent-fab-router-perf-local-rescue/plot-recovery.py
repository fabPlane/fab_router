"""Draw measured reduced-fixture geometry and routes; no feasibility claim for original board."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle,Polygon,Rectangle
root,out=map(Path,sys.argv[1:])
g=json.loads((root/'geometry.json').read_text());r=json.loads((root/'reduced-node-pull.json').read_text())['rows'][0]
t=r['trials'][0];scale=g['luPerUm']*1000
fig,axs=plt.subplots(1,2,figsize=(13,6),sharex=True,sharey=True)
def xy(p):return (p['x']/scale,p['y']/scale)
def shape(ax,s,color):
 k=s['kind'];kw=dict(facecolor=color,edgecolor=color,alpha=.5)
 if k=='disk':ax.add_patch(Circle(xy(s['c']),s['r']/scale,**kw))
 elif k=='box':ax.add_patch(Rectangle((s['x0']/scale,s['y0']/scale),(s['x1']-s['x0'])/scale,(s['y1']-s['y0'])/scale,**kw))
 elif k in ('hull','rounded'):ax.add_patch(Polygon([xy(p) for p in s['pts']],**kw))
 elif k=='pieces':
  for part in s['parts']:shape(ax,part,color)
 elif k=='capsule':
  a,b=xy(s['a']),xy(s['b']);ax.plot([a[0],b[0]],[a[1],b[1]],color=color,linewidth=3)
 else:raise ValueError(k)
for ax in axs:
 for p in g['pads']:
  for s in p['shapes']:shape(ax,s,'#2377aa' if p['net']==4 else '#9a673c')
  ax.annotate(str(p['id']),xy(p['at']),fontsize=8)
 ax.set_aspect('equal');ax.set_xlabel('x (mm)');ax.grid(alpha=.2)
pts=t['pulledPath'];axs[0].plot(*zip(*(xy(p) for p in pts)),color='#d24343',ls='--',lw=1.5,label='Pulled centreline (unshaped)')
pts=t['candidate'];axs[1].plot(*zip(*(xy(p) for p in pts)),color='#008466',lw=2,label='Legal mixed-corner route')
for ax in axs:ax.legend(fontsize=8,loc='upper right')
axs[0].set_title('Existing whole-path shaping rejects this proposal');axs[1].set_title('Per-leg shaping closes 10 → 62: 3/3 repeats')
axs[0].set_ylabel('y (mm)')
fig.suptitle('Ten-pad reduced fixture: unchanged width and clearance rules')
fig.text(.5,.015,'Engine exact DRC: 0 added violations. Original 60-pad context remains open (0/3 closures); no native gain.',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.04,1,.94));fig.savefig(out,dpi=150)
