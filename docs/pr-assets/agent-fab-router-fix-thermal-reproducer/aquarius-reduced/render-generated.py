#!/usr/bin/env python3
"""Plot native error counts for the bounded generated transaction attempts."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1])
s = json.loads((root/'summary.json').read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470"><rect width="1100" height="470" fill="white"/>']
def text(x, y, value, size=20):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{value}</text>')
text(30, 40, 'Geometry-generated native thermal transaction: compact witness', 25)
text(30, 75, 'Nearest foreign track; normal displacement scaled by stored zone gap')
for i, a in enumerate(s['rows'][0]['attempts']):
    x = 70 + 165*i
    errors = len(a['row']['errors'])
    color = '#27845c' if a['accepted'] else '#b85e47'
    svg.append(f'<rect x="{x}" y="{300-errors*50}" width="100" height="{max(3,errors*50)}" fill="{color}"/>')
    text(x+10, 325, f'{a["scale"]:+g} gap')
    text(x+10, 350, f'{errors} errors')
text(30, 395, 'Same outcomes in 3 repeats: first 5 candidates rejected; sixth accepted.')
text(30, 430, 'Accepted: 1 error to 0; 1 open unchanged; all 6 terminals / 4 groups preserved.')
text(30, 460, 'Static diagnostic only; no production routing improvement.', 18)
svg.append('</svg>')
(root/'generated.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert', '-w', '1600', str(root/'generated.svg'), '-o', str(root/'generated.png')], check=True)
