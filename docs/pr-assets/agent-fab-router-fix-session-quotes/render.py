#!/usr/bin/env python3
"""Render actual imported track geometry from the three-repeat audit."""
import html, json, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380">', '<rect width="1000" height="380" fill="#101c28"/>']
def text(x,y,s,size=18,color='#dce8f3'):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{color}">{html.escape(s)}</text>')
text(35,40,'Session import with the design’s apostrophe quote',26)
for x, label, filename in [(35,'Before: copper skipped','before.json'),(525,'After: copper preserved','after.json')]:
    run=json.loads((root/filename).read_text())[0]
    text(x,95,label,23)
    svg.append(f'<rect x="{x}" y="120" width="430" height="140" rx="8" fill="#1c3041" stroke="#587082"/>')
    for t in run['before']:
        pts=' '.join(f'{x+65+(p["x"]-1000)*.3},{190+(p["y"]-1000)*.3}' for p in t['pts'])
        svg.append(f'<polyline points="{pts}" stroke="#526e83" stroke-width="{t["width"]*.3}" fill="none" stroke-dasharray="9 8"/>')
    for t in run['after']:
        pts=' '.join(f'{x+65+(p["x"]-1000)*.3},{190+(p["y"]-1000)*.3}' for p in t['pts'])
        svg.append(f'<polyline points="{pts}" stroke="#ffb95b" stroke-width="{t["width"]*.3}" fill="none"/>')
    text(x,295,f'Imported tracks: {len(run["after"])} / {len(run["before"])}')
    text(x,325,'Net: signal (A) · Layer: front (signal)',16)
text(35,365,'Actual fixture geometry · 1 mm long × 0.2 mm wide · dashed outline marks the input track',16)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
