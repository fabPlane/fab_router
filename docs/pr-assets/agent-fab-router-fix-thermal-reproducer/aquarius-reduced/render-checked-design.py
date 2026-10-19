#!/usr/bin/python3
"""Render measured retained-native replay results; no routing-score claim."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1])
rows = [json.loads((root/phase/'summary.json').read_text()) for phase in ('before', 'after')]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="450"><rect width="1100" height="450" fill="white"/>']
def text(x,y,value,size=22):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{value}</text>')
text(30,42,'Reject native design drift before diagnostic acceptance',27)
text(30,80,'Same 243 retained native checks; three repeats; nine rewritten designs',19)
for index, (label, result) in enumerate(zip(('Before guard', 'After guard'), rows)):
    rejects = sum(r['rejected'] for r in result['rows'] if r['design_drift'])
    clean = sum(not r['rejected'] for r in result['rows'] if not r['design_drift'])
    x=145+490*index
    svg.append(f'<rect x="{x}" y="{300-rejects*18}" width="220" height="{rejects*18}" fill="#28776b"/>')
    text(x,330,label)
    text(x-20,365,f'{rejects}/9 design drifts rejected',20)
    text(x-20,393,f'{clean}/234 unchanged designs allowed',18)
text(30,435,'Diagnostic boundary only; thermal routing failures remain unresolved.',19)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
