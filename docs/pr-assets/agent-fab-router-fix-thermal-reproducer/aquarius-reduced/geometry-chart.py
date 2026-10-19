#!/usr/bin/python3
"""Plot measured native errors for metadata-derived static candidates."""
import json
from pathlib import Path
import subprocess
import sys
out = Path(sys.argv[1])
s = json.loads((out / 'summary.json').read_text())
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="640"><rect width="1100" height="640" fill="white"/><g font-family="sans-serif" fill="#182838"><text x="30" y="38" font-size="25">Geometry-derived thermal dogleg candidates</text><text x="30" y="70" font-size="17">Directions: {s["directions"]}; three nearest tracks; stored zone gap / 5; three repeats</text>']
for i, row in enumerate(s['rows'][:7]):
    y = 100+i*64
    color = '#17815d' if row['eligible'] else '#697686'
    svg.append(f'<text x="30" y="{y+25}" font-size="18">{row["label"]}</text><rect x="270" y="{y}" width="{len(row["errors"])*65}" height="36" fill="{color}"/><text x="{285+len(row["errors"])*65}" y="{y+25}" font-size="18">{len(row["errors"])} errors; {row["opens"]} opens</text>')
svg.append(f'<text x="30" y="580" font-size="18">Selected: {s["selections"][0]}; green candidates pass native error and terminal checks.</text><text x="30" y="615" font-size="16">Static diagnostic only. Stored gap is a search scale; no effective-rule or general repair claim.</text></g></svg>')
(out / 'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(out / 'comparison.svg'), '-o', str(out / 'comparison.png')], check=True)
