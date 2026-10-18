"""Render actual synthetic fixture copper; SVG conversion uses rsvg-convert."""
import json, html, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#101923"/><text x="40" y="40" fill="white" font-size="24">Keep-best restoration after a shove</text>']
for col, name in enumerate(['before', 'after']):
    row = next(x for x in json.loads((root / (name+'.json')).read_text())['results'] if x['detailedNegotiation'])
    ox = 40+col*600
    parts.append(f'<text x="{ox}" y="80" fill="white" font-size="20">{name.title()}: {row["after"]["counts"]["violations"]} clearance violations</text>')
    parts.append(f'<rect x="{ox}" y="110" width="520" height="520" fill="#18382e" stroke="#aec5b8"/>')
    def point(p): return (ox+260+p['x']*.0026,370-p['y']*.0026)
    for t in row['tracks']:
        pts = ' '.join(f'{x:.2f},{y:.2f}' for x,y in map(point,t['pts']))
        color='#ffc266' if t['net']==1 else '#5ddcf7'
        parts.append(f'<polyline points="{pts}" stroke="{color}" stroke-width="{t["width"]*.0026}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in [dict(x=-20000,y=0),dict(x=20000,y=0),dict(x=0,y=-96000),dict(x=0,y=96000)]:
        x,y=point(p);parts.append(f'<rect x="{x-5.2}" y="{y-5.2}" width="10.4" height="10.4" fill="#e7b36e"/>')
    parts.append(f'<text x="{ox}" y="660" fill="white" font-size="16">{len(row["tracks"])} tracks; both nets connected</text>')
parts.append('<text x="40" y="700" fill="#b5c4d0" font-size="16">Blue: requested route. Gold: obstacle net. Actual synthetic geometry; not a native board render.</text></svg>')
(root/'comparison.svg').write_text(''.join(parts))
subprocess.run(['rsvg-convert',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
