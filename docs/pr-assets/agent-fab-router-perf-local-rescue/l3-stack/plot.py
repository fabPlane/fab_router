from pathlib import Path
import json
import subprocess
w=Path(__file__).resolve().parent
s=json.loads((w/'summary.json').read_text())
rows=[('Layered search','aStarLayered'),('Sweep clearance','sweepClear'),('Via fit','barrelFits'),('Lattice collection','collect')]
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="480"><rect width="1100" height="480" fill="white"/><g font-family="sans-serif" fill="#182430"><text x="28" y="35" font-size="23">L3 inclusive sampled stacks — diagnostic only</text><text x="28" y="64" font-size="15">One retained profile per source; nested costs overlap. No route speed claim.</text>']
for i,(label,name) in enumerate(rows):
 y=110+i*76
 svg.append(f'<text x="28" y="{y+18}" font-size="18">{label}</text>')
 for j,(mode,color) in enumerate([('original','#476b99'),('candidate','#d78632')]):
  v=sum(f['inclusive_ms'] for f in s[mode]['frames'] if f['function']==name and f['file'].startswith('src/'))/1000
  svg.append(f'<rect x="240" y="{y+j*27}" width="{v*5.5:.2f}" height="22" fill="{color}"/><text x="{250+v*5.5:.2f}" y="{y+j*27+17}" font-size="15">{v:.3f} s</text>')
svg.append('<text x="28" y="449" font-size="16">Blue: control · Orange: rim traversal · JIT inlining affects attribution</text></g></svg>')
(w/'stacks.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(w/'stacks.svg'),'-o',str(w/'stacks.png')],check=True)
