"""Plot measured fixture tracks and actual pad geometry; centrelines, not copper render."""
import json,pathlib,sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle,Polygon
root=pathlib.Path(__file__).resolve().parent
rows=json.loads((root/'normal-shaping/results.json').read_text())['attempts']
g=json.loads((root/'recovery/geometry.json').read_text())
fig,axes=plt.subplots(1,2,figsize=(12,6),sharex=True,sharey=True)
for ax,mode,title in zip(axes,['control','raw'],['Normal pipeline: target 10–62 open','Raw fallback: target connected (research only)']):
 r=next(r for r in rows if r['context']=='reduced' and r['mode']==mode)
 for pad in g['pads']:
  for shape in pad['shapes']:
   if shape['kind']=='disk':
    ax.add_patch(Circle((shape['c']['x']/10000,-shape['c']['y']/10000),shape['r']/10000,color='#d9a45c',alpha=.65))
  ax.text(pad['at']['x']/10000,-pad['at']['y']/10000,str(pad['id']),fontsize=7)
 for t in r['routerTracks']:
  ax.plot([p['x']/10000 for p in t['pts']],[-p['y']/10000 for p in t['pts']],lw=2,label=f"sheet {t['sheet']}")
 if mode=='control':
  pads={p['id']:p['at'] for p in g['pads']}; a,b=pads[10],pads[62]
  ax.plot([a['x']/10000,b['x']/10000],[-a['y']/10000,-b['y']/10000],'--',color='crimson',lw=1)
 ax.set_title(title,fontsize=11);ax.set_aspect('equal');ax.autoscale_view();ax.set_xlabel('x (mm)');ax.grid(alpha=.2)
 ax.text(.02,.02,f"{r['stats']['barrels']['total']} vias; {r['stats']['tracks']['totalLengthMm']:.3f} mm",transform=ax.transAxes)
axes[0].set_ylabel('−y (mm)')
fig.suptitle('Ten-pad reduced context · unchanged widths and clearances · zero exact engine violations\nOriginal 60-pad context remains open in all three repeats',fontsize=12)
fig.tight_layout();fig.savefig(sys.argv[1],dpi=160)
