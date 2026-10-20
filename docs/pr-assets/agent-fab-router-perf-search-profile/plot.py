"""Render disjoint sampled percentages; standard library plus rsvg-convert."""
import json
from pathlib import Path
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parent
s = json.loads((root / 'summary.json').read_text())
colors = ['#243c6b', '#267b99', '#39a89b', '#999999', '#dab53e', '#c57849', '#9161a8']
groups = sorted(next(iter(s.values()))['disjoint_us'])
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="white"/><g font-family="sans-serif" fill="#182936"><text x="30" y="42" font-size="25">Search costs in three retained default-setting profiles</text><text x="30" y="75" font-size="17">Disjoint sampled stack time; no new routes or measured speed improvement</text>']
for i, (case, r) in enumerate(s.items()):
 y = 125 + i * 85
 svg.append(f'<text x="30" y="{y}" font-size="17">{escape(case.removesuffix("-profiled.cpuprofile.gz"))}</text>')
 x = 30
 for g,c in zip(groups,colors):
  w = r['disjoint_us'][g] / r['sampled_us'] * 1120
  svg.append(f'<rect x="{x:.4f}" y="{y+12}" width="{w:.4f}" height="32" fill="{c}"/>')
  x += w
for i,(g,c) in enumerate(zip(groups,colors)):
 x = 30 + (i%2)*580; y = 410 + (i//2)*38
 svg.append(f'<rect x="{x}" y="{y-15}" width="22" height="22" fill="{c}"/><text x="{x+34}" y="{y+2}" font-size="18">{escape(g)}</text>')
svg.append('</g></svg>\n')
(root/'profile.svg').write_text(''.join(svg))
