"""Render measured fixture and inserted copper from regressions.json; units are LU."""
import json
from pathlib import Path
import subprocess
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parent
rows = json.loads((root / 'candidates.json').read_text())['runs']
versions = [next(r['audit'] for r in rows if r['version'] == v) for v in ['before', 'after']]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="870" viewBox="0 0 1400 870">', '<rect width="1400" height="870" fill="#101923"/>', '<g font-family="sans-serif" fill="#eef3f7">', '<text x="40" y="40" font-size="25">Reachable plane copper: measured candidate search</text>', '<text x="40" y="70" font-size="17">Blue: plane copper   Red: signal pad   Green: inserted via (projected layers)</text>']
for col, data in enumerate(versions):
    x = 45 + col * 695
    svg.append(f'<text x="{x}" y="110" font-size="22">{"Before: first candidate only" if col == 0 else "After: continue candidate search"}</text>')
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
        for track in case['tracks']:
            svg.append(f'<polyline points="{points(track["pts"])}" fill="none" stroke="#fa705f" stroke-width="{track["width"]*scale}" stroke-linecap="round"/>')
        for via in case['barrels']:
            vx, vy = cx+via['at']['x']*scale, cy-via['at']['y']*scale
            svg.append(f'<circle cx="{vx}" cy="{vy}" r="{case["viaRadius"]*scale}" fill="#72e3a2"/><circle cx="{vx}" cy="{vy}" r="{1000*scale}" fill="#101923"/>')
        svg.append(f'<text x="{x}" y="{y+325}" font-size="16">{len(case["barrels"])} via; {case["drc"]["incompletes"]} open; {case["drc"]["violations"]} engine violations</text>')
svg += ['<text x="40" y="850" font-size="16">Same scale in every panel. Later candidates complete these synthetic fixtures; native sweep reported separately.</text>', '</g></svg>']
path = root / 'plane-candidates.svg'
path.write_text('\n'.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(path), '-o', str(root / 'plane-candidates.png')], check=True)
