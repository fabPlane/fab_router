#!/usr/bin/python3
"""Render the measured bounded candidate selection without extra Python packages."""
import json
from pathlib import Path
import subprocess
import sys
out = Path(sys.argv[1])
s = json.loads((out / 'summary.json').read_text())
rows = s['rows'][:5]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520"><rect width="1100" height="520" fill="white"/>',
       '<g font-family="sans-serif" fill="#182838"><text x="35" y="45" font-size="25">Full-board bounded dogleg selection</text><text x="35" y="78" font-size="16">Native errors per candidate; three identical repeats; 15 opens throughout</text>']
for i, row in enumerate(rows):
    y = 115 + i * 65
    color = '#17815d' if row['eligible'] else '#697686'
    svg.append(f'<text x="35" y="{y+25}" font-size="18">{row["label"]}</text><rect x="285" y="{y}" width="{len(row["errors"])*65}" height="36" fill="{color}"/><text x="{300+len(row["errors"])*65}" y="{y+25}" font-size="18">{len(row["errors"])} errors; {"selected" if row["eligible"] else "rejected"}</text>')
svg.append('<text x="35" y="475" font-size="17">All candidates preserve terminal pairs. Selection also rejects new error records.</text><text x="35" y="502" font-size="15">Fixture-specific static experiment; frozen-suite thermal failures remain unresolved.</text></g></svg>')
(out / 'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(out / 'comparison.svg'), '-o', str(out / 'comparison.png')], check=True)
