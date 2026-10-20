"""Render synthetic outcome counts, never a routing speed claim."""
import json
from pathlib import Path
p = Path(__file__).resolve().parent
s = json.loads((p / 'summary.json').read_text())
labels = ['Intersection', 'Endpoint 1 accepts', 'Endpoint 2 accepts', 'Endpoint 3 accepts', 'Endpoint 4 accepts', 'All endpoints reject']
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470" viewBox="0 0 1100 470"><rect width="1100" height="470" fill="#fff"/><g font-family="sans-serif" fill="#172b4d"><text x="30" y="40" font-size="26">Segment threshold: synthetic equivalence corpus</text><text x="30" y="75" font-size="18">838,206 comparisons; zero mismatches. No routing timing or workload claim.</text>']
for i, (label, count) in enumerate(zip(labels, s['syntheticBins'])):
    y = 115 + i * 48
    svg.append(f'<text x="30" y="{y+21}" font-size="18">{label}</text><rect x="260" y="{y}" width="{count/max(s["syntheticBins"])*620:.3f}" height="30" fill="#3677aa"/><text x="900" y="{y+21}" font-size="18">{count:,}</text>')
svg.append('<text x="30" y="440" font-size="17">72 out-of-domain comparisons use the original distance predicate.</text></g></svg>')
(p/'chart.svg').write_text('\n'.join(svg)+'\n')
