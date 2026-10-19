#!/usr/bin/python3
"""Plot the retained native clearance isolation measurements."""
import json
from pathlib import Path
import subprocess
import sys
out = Path(sys.argv[1])
rows = json.loads((out / 'summary.json').read_text())['rows'][:3]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="360"><rect width="1100" height="360" fill="white"/><g font-family="sans-serif" fill="#182838"><text x="30" y="40" font-size="24">Translated segment introduces a clearance violation</text><text x="30" y="75" font-size="17">Full board; three identical native repeats per variant; 15 opens throughout</text>']
for i, r in enumerate(rows):
    y = 105 + i * 60
    color = '#bb453e' if r['pair_errors'] else '#697686'
    svg.append(f'<text x="30" y="{y+24}" font-size="18">{r["label"]}</text><rect x="350" y="{y}" width="{len(r["errors"])*65}" height="35" fill="{color}"/><text x="{365+len(r["errors"])*65}" y="{y+24}" font-size="18">{len(r["errors"])} errors</text>')
svg.append('<text x="30" y="315" font-size="17">Track to U1 pad 40: 0.093 mm clearance versus 0.127 mm required.</text><text x="30" y="343" font-size="16">Restoring endpoints removes the error while retaining both links. Diagnostic only.</text></g></svg>')
(out / 'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(out / 'comparison.svg'), '-o', str(out / 'comparison.png')], check=True)
