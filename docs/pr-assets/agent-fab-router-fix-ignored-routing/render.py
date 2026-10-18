#!/usr/bin/env python3
"""Render actual audit copper on the synthetic one-layer fixture."""
import json, pathlib, subprocess, html
p = pathlib.Path(__file__).resolve().parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="850" viewBox="0 0 1400 850"><rect width="1400" height="850" fill="#101c2c"/>']
for i, version in enumerate(['before','after']):
    r = next(r for r in json.loads((p/(version+'.json')).read_text()) if r['ignored'] and r['shoveEnabled'] and not r['detailedNegotiation'])
    ox, oy, scale = 40+i*700, 130, .003
    tr = lambda q: (ox+300+q['x']*scale, oy+300-q['y']*scale)
    svg.append(f'<text x="{ox}" y="45" fill="white" font-size="25">{version.title()}: ignored net obstacle</text>')
    caption = 'Ignored copper moved; active connection completes' if i == 0 else 'Ignored copper preserved; active connection stays open'
    svg.append(f'<text x="{ox}" y="82" fill="#b5c5d8" font-size="18">{caption}</text>')
    svg.append(f'<rect x="{ox}" y="{oy}" width="600" height="600" fill="#192a38" stroke="#889bac"/>')
    for t in r['tracks']:
        pts=' '.join(f'{x},{y}' for x,y in map(tr,t['pts']))
        color='#ffbb55' if t['net']==1 else '#52d2e8'
        svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{t["width"]*scale}" stroke-linejoin="round" stroke-linecap="round"/>')
    for pad in r['pads']:
        x,y=tr(pad['at']); color='#ffbb55' if pad['net']==1 else '#52d2e8'
        svg.append(f'<rect x="{x-6}" y="{y-6}" width="12" height="12" fill="{color}"/>')
    svg.append(f'<text x="{ox}" y="780" fill="#b5c5d8" font-size="18">Amber: ignored net · Cyan: active net · Board: 20 × 20 mm</text>')
svg.append('</svg>')
(p/'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(p/'comparison.svg'),'-o',str(p/'comparison.png')],check=True)
