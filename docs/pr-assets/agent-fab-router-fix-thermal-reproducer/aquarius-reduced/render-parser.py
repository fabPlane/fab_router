#!/usr/bin/python3
"""Render measured parser controls; no routing measurements."""
import json
from pathlib import Path
import subprocess
import sys
root=Path(sys.argv[1])
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440"><rect width="1100" height="440" fill="white"/>']
def text(x,y,s,size=22):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{s}</text>')
text(30,40,'Require one complete native design tree',28)
text(30,78,'Same 12 parser controls, three repeats, same host; diagnostic only',20)
for index,phase in enumerate(('before','after')):
    rows=json.loads((root/(phase+'.json')).read_text())
    count=sum(r['passed'] for r in rows);x=170+480*index
    svg.append(f'<rect x="{x}" y="{300-count*5}" width="190" height="{count*5}" fill="#26776b"/>')
    text(x,330,phase.capitalize())
    text(x-15,365,f'{count}/{len(rows)} correct results')
text(30,410,'Engine unchanged. No thermal repair or routing improvement claimed.',20)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
