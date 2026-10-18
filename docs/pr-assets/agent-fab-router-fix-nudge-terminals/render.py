"""Render actual synthetic fixture records using rsvg-convert."""
import json, subprocess
from pathlib import Path
p=Path(__file__).parent
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650"><rect width="1200" height="650" fill="#faf9f6"/><g font-family="sans-serif" fill="#242424"><text x="600" y="30" text-anchor="middle" font-size="21">Nudge must preserve terminal membership</text><text x="600" y="54" text-anchor="middle" font-size="15">Actual synthetic fixture geometry · copper in orange · wanted route in blue</text>']
for offset,name,title in [(0,'before','Before: accepts terminal exchange'),(600,'after','After: rejects and restores track')]:
 r=json.loads((p/(name+'.json')).read_text())[0]
 def xy(v):return offset+310+v['x']*.0045,345-v['y']*.0045
 svg.append(f'<text x="{offset+300}" y="95" text-anchor="middle" font-size="19">{title}</text>')
 for t in r['after']:
  pts=' '.join(f'{x},{y}' for x,y in map(xy,t['pts']))
  svg.append(f'<polyline points="{pts}" fill="none" stroke="#b55b22" stroke-width="9" stroke-linejoin="round"/>')
 for pad in r['pads']:
  x,y=xy(pad['at']);label={10:'A',11:'B',12:'C: originally joined',13:'D: originally isolated'}[pad['id']]
  svg.append(f'<rect x="{x-5}" y="{y-5}" width="10" height="10" fill="#b55b22"/><text x="{x+12}" y="{y-10}" font-size="14">{label}</text>')
 x,y=xy({'x':-20000,'y':0});x2,y2=xy({'x':20000,'y':0})
 svg.append(f'<path d="M{x},{y} L{x2},{y2}" stroke="#156b9b" stroke-width="4" stroke-dasharray="8 6"/>')
 svg.append(f'<text x="{offset+300}" y="590" text-anchor="middle" font-size="16">Both states: 1 open, 0 spacing violations</text>')
svg.append('</g></svg>');(p/'terminal-preservation.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(p/'terminal-preservation.svg'),'-o',str(p/'terminal-preservation.png')],check=True)
