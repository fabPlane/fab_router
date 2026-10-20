"""Plot the selected immutable pad geometry; never depicts a retained route."""
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon
source, output = map(Path, sys.argv[1:])
if output.exists():
    raise SystemExit('Refusing existing output')
data = json.loads(source.read_text())
fig, axes = plt.subplots(1, 2, figsize=(12, 7))
for variant, ax in enumerate(axes):
    records = [r for r in data['selected'] if r['variant'] == variant]
    seg = records[0]['segment']
    scale = records[0]['luPerUm'] * 1000
    a, b = [tuple(seg['seg'][p][k] / scale for k in ('x', 'y')) for p in ('a', 'b')]
    radius = seg['width'] / (2 * scale)
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = (dx*dx+dy*dy)**.5
    nx, ny = -dy/length*radius, dx/length*radius
    ax.add_patch(Polygon([(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)], color='tab:blue', alpha=.65))
    for pt in (a,b):
        ax.add_patch(Circle(pt,radius,color='tab:blue',alpha=.65))
    for r in records:
        for shape in r['shapes']:
            if shape['kind'] != 'disk':
                raise ValueError('Selected fixture must contain disk pads')
            c = tuple(shape['c'][k]/scale for k in ('x','y'))
            rad = shape['r']/scale
            clearance = r['metrics'][0]['required']/scale
            ax.add_patch(Circle(c,rad+clearance,fill=False,ls='--',color='tab:red'))
            ax.add_patch(Circle(c,rad,color='tab:red',alpha=.5))
            ax.text(c[0],c[1],str(r['blocker']['id']),ha='center',va='center',fontsize=9)
    ax.autoscale_view(); ax.set_aspect('equal'); ax.set_xlabel('x (mm)'); ax.set_ylabel('y (mm)')
    ax.set_title(['Variant 0: 125 µm gap < 200 µm rule','Variant 1: copper overlap at pads 34 / 35'][variant])
fig.suptitle('Original endpoint approach: two rejected shaping variants\nBlue: trial segment; red: original pad copper; dashed: required spacing')
fig.tight_layout(); fig.savefig(output,dpi=150)
