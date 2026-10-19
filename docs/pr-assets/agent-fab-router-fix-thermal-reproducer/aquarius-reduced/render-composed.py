#!/usr/bin/python3
"""Render measured sequential diagnostic error counts."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1])
s = json.loads((root/'summary.json').read_text())
r = s['rows'][0]
rows = [('Original', r['baseline'])] + [(f'Proposal {i+1}', step['row']) for i, step in enumerate(r['steps'])]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440"><rect width="1000" height="440" fill="white"/>']
def label(x,y,t,size=22):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{t}</text>')
label(30,40,'Sequential native thermal proposal replay',28)
label(30,78,'Full board; three repeats and an independent refill after each sequence',19)
for i,(name,row) in enumerate(rows):
    n=len(row['errors']); x=90+300*i
    svg.append(f'<rect x="{x}" y="{300-28*n}" width="160" height="{28*n}" fill="#297b69"/>')
    label(x,330,name);label(x,355,f'{n} errors; {row["opens"]} opens',18)
label(30,397,'Static diagnostic only. No engine repair or routing benchmark gain.',20)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
