#!/usr/bin/env python3
"""Render measured copper, pads and Prior regions without invented route geometry."""
import json, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent
before, after = [json.loads((root / f'{label}.json').read_text()) for label in ('before', 'after')]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="820" viewBox="0 0 1400 820"><rect width="1400" height="820" fill="#101c2a"/>']
for row, concave in enumerate((False, True)):
 for col, (label, records) in enumerate((('Before', before), ('After', after))):
  record = next(r for r in records if r['concave'] == concave)
  state = record['after']; ox, oy = 350 + col * 700, 235 + row * 380
  def point(p): return f'{ox+p["x"]*.0025},{oy-p["y"]*.0025}'
  svg.append(f'<text x="{col*700+50}" y="{row*380+45}" fill="white" font-family="sans-serif" font-size="23">{label}: {"concave outline" if concave else "hole"} — {record["opens"]} open, {record["violations"]} DRC</text>')
  for p in state['pours']:
   d = ' '.join('M '+' L '.join(point(v) for v in ring)+' Z' for ring in [p['outline'], *p['holes']])
   svg.append(f'<path d="{d}" fill="#275352" stroke="#65a5a0" fill-rule="evenodd"/>')
  for t in state['tracks']:
   pts = ' '.join(point(p) for p in t['pts']); color = '#f58671' if t['net'] else '#ffe594'
   svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{t["width"]*.0025}" stroke-linecap="round" stroke-linejoin="round"/>')
  for p in state['pads']:
   x,y=map(float,point(p['at']).split(','));color='#f58671' if p['net'] else '#ffe594'
   svg.append(f'<rect x="{x-5}" y="{y-5}" width="10" height="10" fill="{color}"/>')
svg.append('<text x="50" y="805" fill="#bdd0df" font-family="sans-serif" font-size="18">Teal: Prior copper; dark: empty space; yellow: signal; coral: retained obstacle. Actual engine geometry.</text></svg>')
(root/'comparison.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
