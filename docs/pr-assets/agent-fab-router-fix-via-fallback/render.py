"""Render measured synthetic geometry; dashed copper is the rejected candidate, not routed copper."""
import json
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent
audit = json.loads((root / 'regressions.json').read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620">',
       '<rect width="1200" height="620" fill="#111827"/>',
       '<g font-family="sans-serif" fill="#f3f4f6"><text x="40" y="42" font-size="26">Permitted via fallback in a keepout corridor</text>',
       '<text x="40" y="76" font-size="16">Measured synthetic geometry · front-layer view · 10,000 LU = 1 mm</text></g>']
for index, label in enumerate(['before', 'after']):
    data = audit['versions'][label][0]['geometry']
    cx, cy, scale = 300 + index * 600, 315, .018
    def x(v): return cx + v * scale
    def y(v): return cy - v * scale
    svg += [f'<g><text x="{cx-250}" y="126" fill="white" font-family="sans-serif" font-size="22">{label.title()}: {data["opens"]} open, {data["added"]["barrels"]} via</text>']
    for fence in data['fences']:
        box = fence['shape']['box']
        lo, hi = max(box['x0'], -14000), min(box['x1'], 14000)
        svg += [f'<rect x="{x(lo)}" y="{y(10000)}" width="{(hi-lo)*scale}" height="{20000*scale}" fill="#7f1d1d"/>']
    svg += [f'<rect x="{x(-5000)}" y="{y(5000)}" width="{10000*scale}" height="{10000*scale}" fill="#2563eb" opacity=".5"/>',
            f'<circle cx="{cx}" cy="{cy}" r="{5000*scale}" fill="#d97706" opacity=".7"/>',
            f'<circle cx="{cx}" cy="{cy}" r="{6000*scale}" fill="none" stroke="#f87171" stroke-width="3" stroke-dasharray="8 5"/>',
            f'<circle cx="{cx}" cy="{cy}" r="{8000*scale}" fill="none" stroke="#f87171" stroke-dasharray="3 6"/>']
    for barrel in data['barrels']:
        assert barrel['form'] == 4
        svg += [f'<circle cx="{x(barrel["at"]["x"])}" cy="{y(barrel["at"]["y"])}" r="{3000*scale}" fill="#facc15"/>',
                f'<circle cx="{cx}" cy="{cy}" r="{1500*scale}" fill="#111827"/>']
    svg += ['</g>']
svg += ['<g font-family="sans-serif" fill="#e5e7eb" font-size="16">',
        '<text x="40" y="530">Red blocks: barrel keepouts · orange: SMD pad · blue: bottom-layer terminal region</text>',
        '<text x="40" y="560">Dashed red: rejected 1.2 mm via; dotted: its 0.2 mm clearance envelope</text>',
        '<text x="40" y="590">Yellow: accepted 0.6 mm via · both outputs: zero engine DRC violations · three identical repeats</text></g></svg>']
(root / 'geometry.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(root / 'geometry.svg'), '-o', str(root / 'geometry.png')], check=True)
