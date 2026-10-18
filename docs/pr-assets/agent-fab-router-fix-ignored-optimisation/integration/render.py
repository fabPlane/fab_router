"""Render the actual audited geometry; requires rsvg-convert."""
import html
import json
from pathlib import Path
import subprocess
root = Path(__file__).parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="620">', '<rect width="1600" height="620" fill="#101b29"/>']
def label(x, y, text, size=21):
    svg.append(f'<text x="{x}" y="{y}" fill="#eef3fa" font-family="sans-serif" font-size="{size}">{html.escape(text)}</text>')
label(35, 45, 'Ignored copper and active island cleanup: both guards must survive integration', 28)
for i, (mode, title) in enumerate([('cleanup', 'Cleanup only'), ('ignored', 'Ignored-net guards only'), ('composed', 'Both fixes')]):
    run = json.loads((root / (mode + '.json')).read_text())['runs'][0]
    ox = 30 + 530 * i
    label(ox, 110, title, 25)
    def xy(p): return ox + 250 + p['x']/240, 310 - p['y']/240
    svg.append(f'<rect x="{ox}" y="145" width="510" height="325" rx="10" fill="#1a2a3e"/>')
    for t in run['after']['tracks']:
        color = '#eac266' if t['net'] == 1 else ('#ff7777' if t['sheet'] == 0 else '#77b7ff')
        pts = ' '.join(f'{x:.2f},{y:.2f}' for x,y in map(xy,t['pts']))
        svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="8" stroke-linejoin="round"/>')
    for x in [-50000, 50000]:
        px,py=xy(dict(x=x,y=0))
        svg.append(f'<rect x="{px-12}" y="{py-12}" width="24" height="24" fill="#eeeeee"/>')
    for b in run['after']['barrels']:
        px,py=xy(b['at'])
        svg.append(f'<circle cx="{px}" cy="{py}" r="12" fill="#eeeeee"/><circle cx="{px}" cy="{py}" r="5" fill="#101b29"/>')
    label(ox, 510, f"Ignored copper preserved: {run['preserved']}")
    label(ox, 545, f"Active island removed: {run['activeIslandRemoved']}")
label(35, 590, 'Red: F.Cu, blue: B.Cu, gold: active island, white: pads/via. Synthetic fixture; three identical audits per version.', 19)
svg.append('</svg>')
(root/'composition.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'composition.svg'),'-o',str(root/'composition.png')],check=True)
