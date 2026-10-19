#!/usr/bin/python3
"""Render repeated native junction diagnostic outcomes from retained evidence."""
import gzip
import html
import json
from pathlib import Path
import subprocess
import sys
root=Path(sys.argv[1]);path=root/'native'/'summary.json'
s=json.loads(path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="540"><rect width="1160" height="540" fill="white"/>']
def text(x,y,value,size=21):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(str(value))}</text>')
text(30,48,'Coherent track junction proposals at U1.53',29)
text(30,90,'Same composed board and host; native refill and DRC; three repeats')
for i,r in enumerate(s['rows']):
    attempts=r['attempts'];removed=sum(not a['row']['target'] for a in attempts if a['row'])
    errors=[len(a['row']['errors']) for a in attempts if a['row']]
    text(30,150+i*88,f'Repeat {r["repeat"]}: {len(attempts)} proposals; {removed} remove target; accepted: {r["accepted"]}')
    text(50,184+i*88,f'Candidate errors: {min(errors)}–{max(errors)}; selected errors/opens: '+
         (f'{len(r["baseline"]["errors"])}/{r["baseline"]["opens"]} (unchanged)' if not r['accepted'] else 'validated candidate'),19)
text(30,450,'Endpoint groups move together. Pads, vias and interior contacts remain fixed.',19)
text(30,492,'Diagnostic only. No production repair or routing improvement claimed.',21)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
