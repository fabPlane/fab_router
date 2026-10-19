#!/usr/bin/python3
"""Plot measured rejection reasons for remaining native thermal targets."""
import html
import gzip
import re
import json
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1])
s = json.loads((root/'audit.json').read_text())
summary = json.loads(gzip.decompress((root/'summary.json.gz').read_bytes()) if (root/'summary.json.gz').exists() else (root/'summary.json').read_bytes())
labels = {}
for error in summary['rows'][0]['baseline']['errors']:
    for item in error['items']:
        match = re.search(r'Pad (\S+) .* of (\S+) on', item['description'])
        if match:
            labels[item['uuid']] = f'{match[2]}.{match[1]}'
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="560"><rect width="1180" height="560" fill="white"/>']
def text(x,y,value,size=20):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(str(value))}</text>')
text(30,42,'Remaining native thermal failures: bounded geometry search',27)
text(30,78,'Composed full board; two nearest tracks per pad; three repeats',20)
text(30,110,'Counts below are per repeat. Rejection reasons may overlap.',18)
for i,(target,rows) in enumerate(s['targets'].items()):
    r=rows[0]; y=155+i*84
    text(30,y,labels.get(target,target),22)
    text(30,y+25,f'{r["proposals"]} proposals; accepted: {r["accepted"]}',17)
    counts=r['reasons']
    for j,(key,color) in enumerate((('target_thermal_remains','#697c95'),('new:clearance','#b85b45'),('new:shorting_items','#a06eab'))):
        value=counts.get(key,0); x=455+j*230
        svg.append(f'<rect x="{x}" y="{y-18}" width="{value*8}" height="20" fill="{color}"/>')
        text(x,y+25,f'{key}: {value}',15)
text(30,518,'Static diagnostic only. Four thermal errors and fifteen opens remain; no production fix.',19)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
