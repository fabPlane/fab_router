#!/usr/bin/env python3
"""Render measured fixture copper, without modifying benchmark geometry."""
import json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parent
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="760" viewBox="0 0 1300 760"><rect width="1300" height="760" fill="#101c29"/>']
for col,name in enumerate(['before','after']):
 d=json.loads((root/f'{name}.json').read_text())[0]
 ox=325+650*col; oy=390
 def pt(p): return f'{ox+p["x"]*.00265:.2f},{oy-p["y"]*.00265:.2f}'
 svg.append(f'<text x="{col*650+40}" y="55" fill="white" font-family="sans-serif" font-size="27">{name.title()}: reported success, {d["incomplete"]} open</text>')
 svg.append(f'<rect x="{ox-265}" y="{oy-265}" width="530" height="530" rx="8" fill="#162d3d" stroke="#6a8d9f"/>')
 for pour in d['before']['pours']:
  svg.append(f'<polygon points="{" ".join(pt(p) for p in pour["outline"])}" fill="#44c4b4"/>')
 for t in d['tracks']:
  color='#f0b861' if t['net']==0 else '#f26468'
  svg.append(f'<polyline points="{" ".join(pt(p) for p in t["pts"])}" fill="none" stroke="{color}" stroke-width="{t["width"]*.00265}" stroke-linecap="round" stroke-linejoin="round"/>')
 for p in d['before']['pads']:
  x,y=map(float,pt(p['at']).split(','));color='#f0b861' if p['net']==0 else '#f26468'
  svg.append(f'<rect x="{x-5.3}" y="{y-5.3}" width="10.6" height="10.6" fill="{color}"/>')
 svg.append(f'<text x="{col*650+40}" y="700" fill="#cad9e6" font-family="sans-serif" font-size="21">Amber: signal · Red: locked obstacle · Teal: prior copper</text>')
svg.append('</svg>')
(root/'prior-connectivity.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'prior-connectivity.svg'),'-o',str(root/'prior-connectivity.png')],check=True)
