from pathlib import Path
import json,subprocess
p=Path(__file__).resolve().parent;s=json.loads((p/'summary.json').read_text())
a=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520"><rect width="1200" height="520" fill="white"/><g font-family="sans-serif" fill="#18293b"><text x="35" y="40" font-size="25">Larger initial visited-state table: focused speed experiment</text><text x="35" y="75" font-size="17">Three alternating pairs per case · same cores 12–19 · median direct replay seconds</text>']
for i,(case,r) in enumerate(s.items()):
 y=115+i*120;a.append(f'<text x="35" y="{y}" font-size="17">{case}</text>')
 for variant,dy,color in [('control',12,'#258a9a'),('candidate',47,'#ba6334')]:
  v=r[variant]['median'];a.append(f'<rect x="145" y="{y+dy}" width="{v*18}" height="26" fill="{color}"/><text x="35" y="{y+dy+20}" font-size="16">{variant}</text><text x="{155+v*18}" y="{y+dy+20}" font-size="16">{v:.3f} s</text>')
a.append('<text x="35" y="495" font-size="16">All 18 sessions identical; engine replay only. No native score or full-suite speed claim.</text></g></svg>')
(p/'timing.svg').write_text(''.join(a));subprocess.run(['rsvg-convert',str(p/'timing.svg'),'-o',str(p/'timing.png')],check=True)
