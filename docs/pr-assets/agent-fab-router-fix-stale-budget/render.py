import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
runs=json.loads((root/'after-grid.json').read_text())
path=runs[0]['single']['path']; scale=12
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="610" viewBox="0 0 1100 610"><rect width="1100" height="610" fill="#101c2b"/><g font-family="sans-serif" fill="#e5eef8"><text x="35" y="44" font-size="26">Stale heap entries exhaust a reachable grid’s search budget</text><text x="35" y="77" font-size="17">Same 30 × 30 grid · budget 4,000 · three repeats per search variant</text>']
for panel,title,detail,color in [(0,'Original: 0/3 connected','4,001 raw pops; budget exhausted','#fbac91'),(1,'Candidate: 3/3 connected','4,437 raw pops; same path as high-budget control','#7ee1bc')]:
 x0=65+panel*535;y0=155
 svg.append(f'<text x="{x0}" y="120" font-size="22" fill="{color}">{title}</text>')
 for x in range(30):
  for y in range(30):
   fill='#d29d63' if x==15 and y!=29 else '#233950'
   svg.append(f'<rect x="{x0+x*scale}" y="{y0+y*scale}" width="11" height="11" fill="{fill}"/>')
 if panel:
  coords=' '.join(f'{x0+p["x"]*scale+5.5},{y0+p["y"]*scale+5.5}' for p in path)
  svg.append(f'<polyline points="{coords}" stroke="#7ee1bc" stroke-width="3" fill="none"/>')
 for x,label in [(14,'S'),(16,'G')]:
  svg.append(f'<circle cx="{x0+x*scale+5.5}" cy="{y0+5.5}" r="6" fill="#f5e78f"/><text x="{x0+x*scale}" y="{y0-10}" font-size="15">{label}</text>')
 svg.append(f'<text x="{x0}" y="545" font-size="16" fill="{color}">{detail}</text>')
svg.append('<text x="35" y="588" font-size="16">Single-layer and layered A* agree. Engine grid diagnostic; native thermal safety is a separate requirement.</text></g></svg>')
(root/'grid.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'grid.svg'),'-o',str(root/'grid.png')],check=True)
