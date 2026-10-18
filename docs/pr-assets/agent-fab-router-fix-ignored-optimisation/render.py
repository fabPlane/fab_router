"""Render actual public-API audit geometry; python3 render.py (needs rsvg-convert)."""
import html
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">', '<rect width="1400" height="620" fill="#101b29"/>']
def label(x, y, text, size=22, color='#eef3fa'):
    svg.append(f'<text x="{x}" y="{y}" fill="{color}" font-family="sans-serif" font-size="{size}">{html.escape(text)}</text>')
label(55, 48, 'Ignored net: a second route call must preserve earlier copper', 28)
label(55, 83, 'Two surface pads on opposite layers; one essential via. Geometry from audit JSON.', 20, '#aec1d7')
for i, name in enumerate(('before', 'after')):
    run = json.loads((root / f'{name}.json').read_text())[0]
    state = run['after']
    ox = 70 + i * 690
    def xy(p):
        return ox + 270 + p['x'] / 220, 320 - p['y'] / 220
    label(ox, 140, 'Before fix' if i == 0 else 'After fix', 26)
    label(ox, 178, f"Native-independent engine check: {state['incompletes']} incomplete", 19)
    svg.append(f'<rect x="{ox}" y="200" width="580" height="260" rx="12" fill="#1a2a3e"/>')
    for t in state['tracks']:
        points = ' '.join(f'{x:.2f},{y:.2f}' for x, y in map(xy, t['pts']))
        color = '#ff7777' if t['sheet'] == 0 else '#77b7ff'
        svg.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>')
    for x, color in ((-50000, '#ff7777'), (50000, '#77b7ff')):
        px, py = xy({'x': x, 'y': 0})
        svg.append(f'<rect x="{px-14}" y="{py-14}" width="28" height="28" rx="4" fill="{color}"/>')
    vx, vy = xy({'x': 0, 'y': 0})
    if state['barrels']:
        svg.append(f'<circle cx="{vx}" cy="{vy}" r="14" fill="#eac266"/><circle cx="{vx}" cy="{vy}" r="6" fill="#101b29"/>')
        label(ox+210, 425, 'Via preserved', 20, '#eac266')
    else:
        svg.append(f'<circle cx="{vx}" cy="{vy}" r="23" fill="none" stroke="#eac266" stroke-width="3" stroke-dasharray="5 4"/>')
        label(ox+195, 425, 'Via deleted: open', 20, '#eac266')
    label(ox, 500, f"Route report: {run['report']['incompleteAfter']} incomplete (ignored net excluded)", 19)
label(55, 562, 'Red: F.Cu    Blue: B.Cu    Gold: via. Before-fix tracks overlap in this projection but are on separate layers.', 19, '#aec1d7')
label(55, 594, 'Synthetic regression fixture; this image is not a native frozen-benchmark board.', 18, '#aec1d7')
svg.append('</svg>')
(root / 'ignored-net.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(root / 'ignored-net.svg'), '-o', str(root / 'ignored-net.png')], check=True)
