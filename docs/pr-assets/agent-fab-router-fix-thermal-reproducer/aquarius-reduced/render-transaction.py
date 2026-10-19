#!/usr/bin/env python3
"""Render transaction counts from the retained native diagnostic summary."""
import json
from pathlib import Path
import subprocess
import sys
from xml.sax.saxutils import escape
root = Path(sys.argv[1])
s = json.loads((root/'summary.json').read_text())
labels = ['Repair', 'Unchanged', 'Disconnected pad', 'Removed pad', 'Timeout', 'Checker failure']
names = ['repair', 'unchanged', 'disconnected', 'missing-pad', 'timeout', 'checker-error']
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="480"><rect width="1000" height="480" fill="white"/>']
def text(x,y,value,size=20):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{escape(value)}</text>')
text(30,40,'Compact native thermal witness: diagnostic transaction',26)
for i,(label,name) in enumerate(zip(labels,names)):
    count = sum(r['accepted'] for r in s['rows'] if r['name'].rsplit('-',1)[0] == name)
    y = 80+52*i
    text(30,y+24,label)
    for j in range(3):
        color = '#27845c' if j < count else '#c5ced8'
        svg.append(f'<rect x="{260+145*j}" y="{y}" width="135" height="34" fill="{color}"/>')
    text(720,y+24,f'{count} accepted / {3-count} rejected')
text(30,425,'Green: accepted. Gray: rejected, exact input bytes returned.',20)
text(30,460,'Three repeats per candidate; no production router integration.',18)
svg.append('</svg>')
(root/'transactions.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'transactions.svg'),'-o',str(root/'transactions.png')],check=True)
