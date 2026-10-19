#!/usr/bin/python3
"""Plot target errors separately from total native errors in static candidates."""
import json
from pathlib import Path
import subprocess
import sys
root=Path(sys.argv[1])
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="850"><rect width="1500" height="850" fill="white"/><g font-family="sans-serif" fill="#192a36"><text x="30" y="35" font-size="25">Missing-corridor obstruction candidates: native target and total errors</text><text x="30" y="68" font-size="18">Two tracks ranked by missing-area overlap; normal offsets ±stored gap and ±2×gap; three native repeats</text>']
for col,name in enumerate(('c1','r20')):
 s=json.loads((root/name/'summary.json').read_text()); count=1+4*len(s['nearby']); x=30+col*740
 svg.append(f'<text x="{x}" y="105" font-size="23">{name.upper()}</text>')
 for i,row in enumerate(s['rows'][:count]):
  y=135+i*64
  color='#b53c40' if row['target'] else '#18764a'
  svg.append(f'<text x="{x}" y="{y+20}" font-size="16">{row["label"]}</text><rect x="{x+210}" y="{y}" width="{len(row["errors"])*20}" height="26" fill="#7892a4"/><text x="{x+220+len(row["errors"])*20}" y="{y+20}" font-size="16">{len(row["errors"])} errors</text><text x="{x+210}" y="{y+46}" font-size="15" fill="{color}">{len(row["target"])} target error; {row["opens"]} opens</text>')
svg.append('<text x="30" y="790" font-size="18">Original terminal inventory and connectivity checked independently; green means target removed.</text><text x="30" y="825" font-size="17">Static experiment; no engine change, routing benchmark gain, or effective-rule inference.</text></g></svg>')
(root/'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
