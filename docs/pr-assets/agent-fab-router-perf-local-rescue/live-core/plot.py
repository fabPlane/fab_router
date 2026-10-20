# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import json,subprocess
p=Path(__file__).resolve().parent
summary=json.loads((p/'summary.json').read_text())
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#fafafa"/><g font-family="sans-serif" fill="#162235"><text x="40" y="42" font-size="26">Prepared live geometry cores: focused engine timings</text><text x="40" y="72" font-size="17">Three alternating pairs per case; seconds; p95 = maximum of three</text>']
for i,s in enumerate(summary):
 y=130+i*105
 svg.append(f'<text x="40" y="{y+15}" font-size="18">{s["case"]}</text>')
 for j,(v,color)in enumerate([('control','#2675b9'),('candidate','#d75c40')]):
  m=s[v]['median'];q=s[v]['p95'];yy=y+28+j*26
  svg.append(f'<rect x="440" y="{yy}" width="{m*13}" height="19" fill="{color}"/><line x1="{440+q*13}" y1="{yy-2}" x2="{440+q*13}" y2="{yy+21}" stroke="#162235"/><text x="{460+q*13}" y="{yy+15}" font-size="16">{m:.3f} / {q:.3f}</text>')
svg.append('<text x="40" y="467" font-size="17">Blue: control · Orange: candidate · No native scoring in these engine replays</text></g></svg>')
(p/'chart.svg').write_text('\n'.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(p/'chart.svg'),'-o',str(p/'chart.png')],check=True)
