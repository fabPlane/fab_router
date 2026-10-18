"""Render measured callback counts, using only stdlib and rsvg-convert."""
import json
from pathlib import Path
import subprocess
p = Path(__file__).resolve().parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="470" viewBox="0 0 1200 470"><rect width="1200" height="470" fill="#111c2c"/>']
for i, version in enumerate(['before', 'after']):
    events = [e for e in json.loads((p / f'{version}.json').read_text())['runs'][1]['events'] if e['kind'] == 'pass']
    x0 = 100 + i * 590
    svg.append(f'<text x="{x0}" y="50" fill="white" font-family="sans-serif" font-size="24">{version.title()}: reported remaining connections</text>')
    svg.append(f'<path d="M{x0} 110 V340 H{x0+390}" fill="none" stroke="#aabacc"/>')
    for j, e in enumerate(events):
        x = x0 + 60 + 130 * j
        svg.append(f'<rect x="{x-19}" y="{340-180*e["reported"]}" width="38" height="{180*e["reported"]}" fill="#62c0f2"/>')
        svg.append(f'<circle cx="{x}" cy="{340-180*e["actual"]}" r="8" fill="#f1bc60"/>')
        svg.append(f'<text x="{x-30}" y="375" fill="white" font-family="sans-serif" font-size="18">Pass {e["pass"]}</text>')
    svg.append(f'<text x="{x0-30}" y="345" fill="white" font-family="sans-serif">0</text><text x="{x0-30}" y="165" fill="white" font-family="sans-serif">1</text>')
svg.append('<text x="70" y="430" fill="#62c0f2" font-family="sans-serif" font-size="19">Blue: callback count</text><text x="340" y="430" fill="#f1bc60" font-family="sans-serif" font-size="19">Gold: actual open connection (same four-pad board, three identical repeats)</text></svg>')
(p / 'progress.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(p / 'progress.svg'), '-o', str(p / 'progress.png')], check=True)
