#!/usr/bin/python3
"""Render measured native error counts; no board geometry is invented."""
import json
import pathlib
import sys

source, target = map(pathlib.Path, sys.argv[1:])
data = json.loads(source.read_text())
names = ('before', 'stale', 'refilled', 'restored')
for row in data['rows']:
    assert row['states'] == data['rows'][0]['states']
colors = {'clearance': '#3478bd', 'hole_clearance': '#7db6dd', 'starved_thermal': '#c94e38'}
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="590" viewBox="0 0 1100 590">',
         '<rect width="1100" height="590" fill="white"/>',
         '<g font-family="sans-serif" fill="#202b36">',
         '<text x="50" y="42" font-size="27">Native validation depends on zone refill</text>',
         '<text x="50" y="75" font-size="18">Same route-producing fixture • KiCad 10.0.6 • identical counts in 3 repeats</text>']
for count in range(7):
    y = 400 - count * 43
    parts.append(f'<path d="M85 {y}H1020" stroke="#dde3e8"/><text x="60" y="{y+6}" font-size="16">{count}</text>')
labels = ('Original filled board', 'Imported, stale fills', 'Imported, refilled', 'Original restored')
for index, (name, label) in enumerate(zip(names, labels)):
    x, y = 125 + index * 230, 400
    errors = data['rows'][0]['states'][name]['errors']
    for kind, color in colors.items():
        height = errors.get(kind, 0) * 43
        y -= height
        parts.append(f'<rect x="{x}" y="{y}" width="125" height="{height}" fill="{color}"/>')
    parts.append(f'<text x="{x+62}" y="{y-12}" text-anchor="middle" font-size="21">{sum(errors.values())}</text>')
    parts.append(f'<text x="{x+62}" y="433" text-anchor="middle" font-size="17">{label}</text>')
for index, (kind, color) in enumerate(colors.items()):
    x = 80 + index * 325
    parts.append(f'<rect x="{x}" y="473" width="20" height="20" fill="{color}"/><text x="{x+30}" y="490" font-size="18">{kind}</text>')
parts.extend(['<text x="50" y="540" font-size="17">Diagnostic only: restoring the original board also restores its 2 native opens.</text>',
              '<text x="50" y="568" font-size="17">No production safety guard, completed routing repair, or benchmark gain is claimed.</text>', '</g></svg>'])
target.write_text('\n'.join(parts) + '\n')
