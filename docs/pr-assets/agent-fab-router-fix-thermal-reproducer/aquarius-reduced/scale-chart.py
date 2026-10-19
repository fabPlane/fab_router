#!/usr/bin/python3
"""Plot repeated static normal-offset outcomes without implying routing gains."""
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
s = json.loads((root/'summary.json').read_text())
count = len(s['rows']) // s['repeats']
rows = s['rows'][:count]
height = 180 + 43*len(rows)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{height}"><rect width="1200" height="{height}" fill="white"/><g font-family="sans-serif" fill="#192a36">',
       '<text x="25" y="35" font-size="25">R20: normal offset scale versus native thermal failure</text>',
       '<text x="25" y="68" font-size="18">Same full board, direction and endpoint links; three native repeats per candidate</text>',
       '<text x="25" y="100" font-size="16">Candidate / offset length</text><text x="490" y="100" font-size="16">Total errors</text><text x="750" y="100" font-size="16">Target errors / opens / eligible</text>']
for i, row in enumerate(rows):
    y = 120 + 43*i
    scale = 0 if row['geometry'] is None else abs(float(row['label'].split('normal-')[1]))
    length = scale*s['step_nm']/1e6
    color = '#18764a' if row['eligible'] else '#b53c40'
    svg.append(f'<text x="25" y="{y+20}" font-size="16">{row["label"]} / {length:.4f} mm</text><rect x="490" y="{y}" width="{len(row["errors"])*25}" height="26" fill="#7892a4"/><text x="660" y="{y+20}" font-size="16">{len(row["errors"])}</text><text x="750" y="{y+20}" font-size="16" fill="{color}">{len(row["target"])} / {row["opens"]} / {row["eligible"]}</text>')
svg.append(f'<text x="25" y="{height-20}" font-size="16">Static native diagnostic; original terminal pairs preserved. No production repair or routing score change.</text></g></svg>')
(root/'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
