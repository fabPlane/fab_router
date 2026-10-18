"""Render the measured fixture copper, with identical scale before and after."""
import json
from pathlib import Path
import subprocess
p = Path(__file__).resolve().parent
panels = []
for index, label in enumerate(['before', 'after']):
    r = json.loads((p / (label + '.json')).read_text())[0]
    shapes = []
    for pad in r['pads']:
        x, y = pad['at']['x'], pad['at']['y']
        color = '#dfb954' if pad['net'] == 0 else '#65768b'
        shapes.append(f'<rect x="{x-7250}" y="{y-2250}" width="14500" height="4500" fill="{color}"/>')
    for t in r['tracks']:
        pts = ' '.join(f"{q['x']},{q['y']}" for q in t['pts'])
        shapes.append(f'<polyline points="{pts}" stroke="#ed7960" stroke-width="{t["width"]}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>')
    panels.append(f'<text x="{30+index*790}" y="55" fill="#f1f4f8" font-size="26">{label.title()}: {r["opens"]} open, {len(r["violations"])} engine DRC violations</text><svg x="{20+index*790}" y="90" width="760" height="390" viewBox="-14000 -15000 65000 30000">' + ''.join(shapes) + '</svg>')
svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="1600" height="600" fill="#142235"/><g font-family="sans-serif">' + ''.join(panels) + '<text x="30" y="530" fill="#d6e0ec" font-size="22">Measured copper at equal scale: gold = power pads; grey = other copper; coral = emitted 0.5 mm track</text><text x="30" y="570" fill="#d6e0ec" font-size="22">The end-cap overlaps the pad while its centre clears the neighbouring copper. No vias or necking.</text></g></svg>'
(p / 'endcap.svg').write_text(svg)
subprocess.run(['rsvg-convert', '-w', '1600', str(p / 'endcap.svg'), '-o', str(p / 'endcap.png')], check=True)
