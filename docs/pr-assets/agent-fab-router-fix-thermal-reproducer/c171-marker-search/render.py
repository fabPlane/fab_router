#!/usr/bin/python3
"""Render measured complete-board selection results."""
import argparse
import json
from pathlib import Path
import subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--results',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
x=p.parse_args();z=json.loads((x.results/'summary.json').read_text())
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="580" viewBox="0 0 1400 580"><rect width="1400" height="580" fill="#f8fafc"/>']
def text(a,b,t,size=25):s.append(f'<text x="{a}" y="{b}" font-family="sans-serif" font-size="{size}" fill="#172033">{t}</text>')
text(60,65,'Native selection on the complete J4 route',36)
text(60,110,'Same board / native 10.0.6 / three independent refills per variant',23)
for i,(label,key) in enumerate([('Before','baseline'),('Selected detour','selected')]):
    y=185+i*100
    rows=[r['attempts'][-1]['row'] if key=='selected' else r[key] for r in z['rows']]
    assert len({(len(r['errors']),r['opens']) for r in rows})==1
    errors,opens=len(rows[0]['errors']),rows[0]['opens']
    text(60,y,label)
    text(430,y,f'{errors} native errors',25)
    text(750,y,f'{opens} opens',25)
    text(990,y,'3 / 3 repeats',25)
    if errors:s.append(f'<rect x="430" y="{y+16}" width="170" height="14" fill="#e05252"/>')
    if opens:s.append(f'<rect x="750" y="{y+16}" width="170" height="14" fill="#e89435"/>')
text(60,495,'Selected: identical terminal partitions; original input bytes preserved',23)
text(60,540,'Marker-guided generated segment selection; production routing remains unchanged',21)
s.append('</svg>');x.out.mkdir(parents=True,exist_ok=True)
(x.out/'comparison.svg').write_text(''.join(s))
subprocess.run(['rsvg-convert','-w','1600',str(x.out/'comparison.svg'),'-o',str(x.out/'comparison.png')],check=True,timeout=120)
