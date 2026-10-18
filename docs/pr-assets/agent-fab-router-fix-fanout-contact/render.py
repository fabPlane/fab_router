#!/usr/bin/env python3
"""Render recorded synthetic regression counts; no plotting dependencies."""
import json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent
runs = json.loads((root/'regressions.json').read_text())['runs']
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520">', '<rect width="1000" height="520" fill="#f5f7fa"/>', '<g font-family="sans-serif" fill="#182a40">', '<text x="45" y="48" font-size="27">Fanout verifies actual pad copper contact</text>', '<text x="45" y="82" font-size="17">Identical 6-test synthetic suite · 3 repeats per version · cores 20–25</text>']
for i, run in enumerate(runs):
    x = 75 + i*145
    h = run['passed']*32
    parts += [f'<rect x="{x}" y="{350-h}" width="88" height="{h}" fill="{"#637b98" if i<3 else "#167b61"}"/>', f'<text x="{x+44}" y="{340-h}" text-anchor="middle" font-size="21">{run["passed"]}/6</text>', f'<text x="{x+44}" y="378" text-anchor="middle" font-size="16">{run["version"]} #{run["repeat"]}</text>']
parts += ['<text x="45" y="424" font-size="18">Before: offset pad anchors retain disconnected vias and report escapes.</text>', '<text x="45" y="455" font-size="18">After: disconnected trials rewind; centred and overlapping controls pass.</text>', '<text x="45" y="491" font-size="15">Not native task scores. No native thermal-safety or completion gain claimed.</text>', '</g></svg>']
(root/'regressions.svg').write_text(''.join(parts))
subprocess.run(['rsvg-convert','-w','1600',str(root/'regressions.svg'),'-o',str(root/'regressions.png')],check=True)
