"""Render measured fixture and inserted copper from regressions.json; units are LU."""
import json
from pathlib import Path
import subprocess
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parent
rows = json.loads((root / 'regressions.json').read_text())
versions = [next(r['audit']['results'] for r in rows if r['version'] == v) for v in ['before', 'after']]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1220" viewBox="0 0 1400 1220">', '<rect width="1400" height="1220" fill="#101923"/>', '<g font-family="sans-serif" fill="#eef3f7">', '<text x="40" y="40" font-size="25">Plane via contact: measured minimal regression</text>', '<text x="40" y="70" font-size="17">Blue: plane copper   Red: signal pad   Green: inserted via (projected layers)</text>']
for col, data in enumerate(versions):
    x = 45 + col * 695
    svg.append(f'<text x="{x}" y="110" font-size="22">{"Before: main" if col == 0 else "After: live terminal check"}</text>')
    for row, case in enumerate(data):
        y = 140 + row * 350
        svg.append(f'<text x="{x}" y="{y}" font-size="19">{escape(case["mode"])}: success={str(case["success"]).lower()}, joined={str(case["joined"]).lower()}</text>')
        cx, cy, scale = x + 295, y + 160, .0026
        def points(pts):
            return ' '.join(f'{cx+p["x"]*scale},{cy-p["y"]*scale}' for p in pts)
        svg.append(f'<rect x="{cx-156}" y="{cy-140}" width="312" height="280" fill="#1c2836" stroke="#748396"/>')
        for pour in case['pours']:
            svg.append(f'<polygon points="{points(pour["outline"])}" fill="#287ab0"/>')
            for hole in pour['holes']:
                svg.append(f'<polygon points="{points(hole)}" fill="#1c2836"/>')
        for pad in case['pads']:
            svg.append(f'<circle cx="{cx+pad["at"]["x"]*scale}" cy="{cy-pad["at"]["y"]*scale}" r="{3000*scale}" fill="#fa705f"/>')
        for via in case['barrels']:
            vx, vy = cx+via['at']['x']*scale, cy-via['at']['y']*scale
            svg.append(f'<circle cx="{vx}" cy="{vy}" r="{case["viaRadius"]*scale}" fill="#72e3a2"/><circle cx="{vx}" cy="{vy}" r="{1000*scale}" fill="#101923"/>')
        svg.append(f'<text x="{x}" y="{y+325}" font-size="16">{len(case["barrels"])} via; {case["drc"]["incompletes"]} open; {case["drc"]["violations"]} engine violations</text>')
svg += ['<text x="40" y="1200" font-size="16">Same scale in every panel. Rejected escapes remain open; no completion improvement claimed.</text>', '</g></svg>']
path = root / 'plane-contact.svg'
path.write_text('\n'.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(path), '-o', str(root / 'plane-contact.png')], check=True)
