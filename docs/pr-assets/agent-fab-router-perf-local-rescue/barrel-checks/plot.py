"""Render the recorded synthetic closure; does not generate or route copper."""
import json,sys,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle,Polygon
p=Path(sys.argv[1]);d=json.loads(p.read_text());fig,axes=plt.subplots(2,1,figsize=(10,5),constrained_layout=True)
for ax,mode in zip(axes,['before','after']):
 r=next(r for r in d['rows'] if r['mode']==mode);l=r['layout']
 for t in l['tracks']:
  color='#c33737'if t['sheet']==0 else '#255cab';radius=t['width']/20000
  for a,b in zip(t['pts'],t['pts'][1:]):
   x,y=a['x']/10000,a['y']/10000;xx,yy=b['x']/10000,b['y']/10000;length=math.hypot(xx-x,yy-y)
   if length:
    nx,ny=-(yy-y)/length*radius,(xx-x)/length*radius
    ax.add_patch(Polygon([(x+nx,y+ny),(xx+nx,yy+ny),(xx-nx,yy-ny),(x-nx,y-ny)],color=color,lw=0))
   for pt in [(x,y),(xx,yy)]:ax.add_patch(Circle(pt,radius,color=color,lw=0))
 for pad in l['pads']:
  ax.add_patch(Circle((pad['at']['x']/10000,pad['at']['y']/10000),.03,color='#c33737' if pad['sheets']==[0] else '#255cab'))
 for b in l['barrels']:
  xy=b['at']['x']/10000,b['at']['y']/10000;ax.add_patch(Circle(xy,.03,color='#a06a1a'));ax.add_patch(Circle(xy,.01,color='white'))
 ax.set(xlim=(-.1,1.3),ylim=(-.08,.08),xlabel='mm',title=f"{mode.title()}: {r['incomplete']} incomplete, {r['violations']} exact-geometry violations",yticks=[])
 ax.set_aspect('equal');ax.grid(axis='x',alpha=.2)
fig.suptitle('Barrel endpoint recovery · retained lower-sheet copper stays connected\nSynthetic engine fixture; red upper sheet, blue lower sheet, gold barrel')
fig.savefig(sys.argv[2],dpi=160)
