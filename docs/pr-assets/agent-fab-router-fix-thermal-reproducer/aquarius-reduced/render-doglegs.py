#!/usr/bin/python3
"""Render selected outcomes separately from rejected candidate counts."""
import gzip,html,json,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]);summary=root/'native/summary.json'
s=json.loads(summary.read_bytes() if summary.exists() else gzip.decompress(Path(str(summary)+'.gz').read_bytes()))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="550"><rect width="1220" height="550" fill="white"/>']
def text(x,y,value,size=22):svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(str(value))}</text>')
text(30,45,'Bent additive links at U1.48: native validation',29)
text(30,86,'Same two-link board and rules; cores 20–25; three repeats',21)
text(30,125,'16 doglegs: eight initial directions × two turns; 0.127 mm width',21)
for index,row in enumerate(s['rows']):
    checked=[a['row'] for a in row['attempts'] if a['row'] is not None]
    selected=next((a['row'] for a in row['attempts'] if a['accepted']),row['baseline'])
    text(30,184+index*90,f'Repeat {row["repeat"]}: before {len(row["baseline"]["errors"])} errors / {row["baseline"]["opens"]} opens → selected {len(selected["errors"])} errors / {selected["opens"]} opens')
    text(50,217+index*90,f'Accepted: {row["accepted"]}; candidates with target removed: {sum(not a["target"] for a in checked)}; candidate errors: {min(len(a["errors"]) for a in checked)}–{max(len(a["errors"]) for a in checked)}',19)
text(30,470,'Quarter-gap exit, then a perpendicular leg of three stored thermal gaps.',20)
text(30,515,'Static diagnostic only; no production routing improvement.',21)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
