"""Render the measured synthetic search grid with the successful path."""
import json, subprocess
from pathlib import Path
p = Path(__file__).resolve().parent
r = json.loads((p/'results.json').read_text())
audit = json.loads((p/'audit.json').read_text())
s = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="780" viewBox="0 0 1100 780"><rect width="1100" height="780" fill="#f5f7fb"/>']
s += ['<g font-family="sans-serif" fill="#17243b"><text x="32" y="42" font-size="26">Reachable grid, exhausted heap-pop budget</text><text x="32" y="74" font-size="17">Synthetic search diagnostic · three repeats · unchanged engine</text></g>']
for y in range(30):
 for x in range(30):
  s.append(f'<rect x="{35+x*20}" y="{105+y*20}" width="19" height="19" fill="{"#34465c" if x==15 and y!=29 else "#e0e7f0"}"/>')
points=' '.join(f'{45+v["x"]*20},{115+v["y"]*20}' for v in r['runs'][0]['expanded']['path'])
s.append(f'<polyline points="{points}" fill="none" stroke="#168467" stroke-width="4"/>')
for x,label in [(14,'S'),(16,'G')]:
 s.append(f'<circle cx="{45+x*20}" cy="115" r="8" fill="#c05826"/><text x="{39+x*20}" y="98" font-family="sans-serif" font-size="16">{label}</text>')
lines=['900 cells; 871 flood-reachable','One wall, one gap; 61 path points','4,000 budget: no path returned','32,000 budget: path at pop 4,437',f'Successful search: {audit["expanded"]["stale"]:,} stale pops',f'{4437-1148:,} non-stale pops (includes goal)','Budget counts heap pops,','including superseded entries.','No production fix adopted.','No native DRC validation.']
for i,line in enumerate(lines):
 s.append(f'<text x="665" y="{145+i*48}" font-family="sans-serif" font-size="19" fill="#17243b">{line}</text>')
s.append('<text x="35" y="748" font-family="sans-serif" font-size="17" fill="#526175">Grid coordinates only; this is not a board or a minimized original DSN.</text></svg>')
(p/'grid.svg').write_text(''.join(s))
subprocess.run(['rsvg-convert','-w','1600',str(p/'grid.svg'),'-o',str(p/'grid.png')],check=True)
