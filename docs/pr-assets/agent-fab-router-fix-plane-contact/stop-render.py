"""Render measured blocked candidate query counts and asserted upper bounds."""
import json
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent
data = json.loads((root / 'stops.json').read_text())['query_assertions']
labels = ['Aborted at entry', 'Expired at entry', 'Aborted during check', 'Expired during check']
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="680" viewBox="0 0 1400 680">', '<rect width="1400" height="680" fill="#101923"/>', '<g font-family="sans-serif" fill="#eef3f7">', '<text x="45" y="45" font-size="27">Blocked plane via search: cancellation and expiry</text>', '<text x="45" y="80" font-size="19">Lattice queries: before measured (red), after asserted upper bound (blue)</text>']
for i, label in enumerate(labels):
    x = 100 + i * 330
    for j, key in enumerate(['before', 'after_upper_bound']):
        v = data[key][i]
        h = v * .85
        bx = x + j * 100
        svg.append(f'<rect x="{bx}" y="{500-h}" width="75" height="{h}" fill="{["#c45a50", "#39a4c4"][j]}"/>')
        svg.append(f'<text x="{bx+37}" y="{485-h}" text-anchor="middle" font-size="22">{v}</text>')
    svg.append(f'<text x="{x+87}" y="540" text-anchor="middle" font-size="18">{label}</text>')
svg += ['<text x="45" y="600" font-size="19">Identical synthetic fixture; three repeats per version. No copper retained; one open, zero violations.</text>', '<text x="45" y="630" font-size="18">Query bounds test interruption between candidates; they do not promise interruption within a clearance check.</text>', '</g></svg>']
(root / 'plane-stops.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(root / 'plane-stops.svg'), '-o', str(root / 'plane-stops.png')], check=True)
