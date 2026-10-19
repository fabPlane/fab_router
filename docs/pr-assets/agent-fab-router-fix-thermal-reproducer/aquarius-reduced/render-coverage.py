#!/usr/bin/python3
"""Plot independent full-board native transaction coverage, without combined claims."""
import argparse
from html import escape
import json
from pathlib import Path
import subprocess
import pcbnew

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('--source', type=Path, required=True)
a = p.parse_args()
s = json.loads((a.results/'summary.json').read_text())
board = pcbnew.LoadBoard(str(a.source))
pads = {p.m_Uuid.AsString(): f'{p.GetParentFootprint().GetReference()}.{p.GetNumber()}'
        for p in board.GetPads()}
rows = [r for r in s['rows'] if r['repeat'] == 1]
height = 220 + 65*len(rows)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{height}"><rect width="1200" height="{height}" fill="white"/>']
def text(x, y, value, size=20):
    svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{escape(str(value))}</text>')
text(30, 40, 'Full-board geometry proposal coverage: independent pad trials', 25)
text(30, 76, 'Nearest foreign track; signed stored-gap normal steps; native validation; 3 repeats')
text(30, 112, 'Pad')
text(210, 112, 'Native errors before / selected')
text(650, 112, 'Proposals tried')
text(900, 112, 'Accepted repeats')
for index, row in enumerate(rows):
    y = 158+65*index
    group = [r for r in s['rows'] if r['pad_uuid'] == row['pad_uuid']]
    assert len(group) == 3
    after = row['attempts'][-1]['row'] if row['accepted'] else row['baseline']
    text(30, y, pads[row['pad_uuid']])
    text(210, y, f'{len(row["baseline"]["errors"])} / {len(after["errors"])}')
    text(650, y, len(row['attempts']))
    text(900, y, f'{sum(r["accepted"] for r in group)}/3')
text(30, height-55, 'All proposals start from the original board. Accepted changes are not composed.')
text(30, height-20, 'Static diagnostic only; no production routing improvement.', 18)
svg.append('</svg>')
(a.results/'coverage.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert', '-w', '1600', str(a.results/'coverage.svg'),
                '-o', str(a.results/'coverage.png')], check=True)
