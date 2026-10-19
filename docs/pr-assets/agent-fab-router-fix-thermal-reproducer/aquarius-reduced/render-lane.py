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
text(30,48,'Pad-oriented lane proposals at U1.53',29)
text(30,90,'Same composed board and host; native refill and DRC; three repeats')
for i,r in enumerate(s['rows']):
    attempts=r['attempts']
    reports=[]
    for a in attempts:
        f=root/'native'/a['name']/'drc.json'
        reports.append(json.loads(f.read_bytes() if f.exists() else gzip.decompress(Path(str(f)+'.gz').read_bytes())))
    removed=sum(not any(v['type']=='starved_thermal' and any(i['uuid']=='12cbe2ed-3861-4e0e-89f1-6c66f25e5228' for i in v['items']) for v in report['violations']) for report in reports)
    errors=[sum(v['severity']=='error' for v in report['violations']) for report in reports]
    text(30,150+i*88,f'Repeat {r["repeat"]}: {len(attempts)} proposals; {removed} remove target; accepted: {r["accepted"]}')
    text(50,184+i*88,f'Candidate errors: {min(errors)}–{max(errors)}; selected errors/opens: '+
         (f'{len(r["baseline"]["errors"])}/{r["baseline"]["opens"]} (unchanged)' if not r['accepted'] else 'validated candidate'),19)
text(30,450,'Two remote endpoints stay fixed; only the connecting track pair is replaced.',19)
text(30,492,'Diagnostic only. No production repair or routing improvement claimed.',21)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
