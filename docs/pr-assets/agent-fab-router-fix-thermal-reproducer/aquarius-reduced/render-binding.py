#!/usr/bin/python3
"""Plot measured diagnostic verifier controls, not routing results."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1])
rows = [json.loads((root/phase/'summary.json').read_text()) for phase in ('before', 'after')]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="440"><rect width="1080" height="440" fill="white"/>']
def text(x, y, value, size=22):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{value}</text>')
text(30, 42, 'Bind native diagnostic boards to the proposed designs', 27)
text(30, 78, 'Same five controls before and after; one invocation per control', 19)
for index, (label, result) in enumerate(zip(('Before', 'After'), rows)):
    rejects = sum(not row['accepted'] for row in result if not row['expected_accept'])
    x = 140+470*index
    svg.append(f'<rect x="{x}" y="{300-rejects*40}" width="200" height="{rejects*40}" fill="#297b69"/>')
    text(x, 330, label)
    text(x-25, 365, f'{rejects}/4 substitutions rejected', 20)
text(30, 410, 'Original evidence passes both versions. Static verifier fix; no routing gain.', 20)
svg.append('</svg>')
(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert', '-w', '1600', str(root/'comparison.svg'), '-o', str(root/'comparison.png')], check=True)
