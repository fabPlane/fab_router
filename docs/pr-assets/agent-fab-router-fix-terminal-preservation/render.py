#!/usr/bin/env python3
"""Plot actual synthetic fixture geometry from audit.ts; not a native board render."""
import json, pathlib
HERE = pathlib.Path(__file__).resolve().parent
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">', '<rect width="1200" height="650" fill="#111b2d"/>', '<g font-family="sans-serif" fill="#e2e8f0">', '<text x="40" y="45" font-size="26">Preserve terminal connections during optimisation</text>', '<text x="40" y="78" font-size="17">Same fixture geometry · one net · circles are pads · units mm</text>']
for offset, name, title in [(0, 'before', 'Baseline: shortcut exchanges terminals'), (590, 'after', 'Fix: reject the disconnecting shortcut')]:
    row = json.loads((HERE / (name + '.json')).read_text())['rows'][0]
    state = row['after']
    point = lambda p: (offset + 300 + p['x'] * .05, 420 - p['y'] * .05)
    parts.append(f'<text x="{offset+40}" y="125" font-size="21">{title}</text>')
    if name == 'before':
        pts = ' '.join('%g,%g' % point(p) for p in row['before']['tracks'][0]['pts'])
        parts.append(f'<polyline points="{pts}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="7 7"/>')
    for t in state['tracks']:
        pts = ' '.join('%g,%g' % point(p) for p in t['pts'])
        parts.append(f'<polyline points="{pts}" fill="none" stroke="#38bdf8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in state['pads']:
        x,y = point(p['at']); connected = p['component'] == state['pads'][0]['component']
        colour = '#34d399' if connected else '#fb7185'
        parts.extend([f'<circle cx="{x}" cy="{y}" r="9" fill="{colour}" stroke="#111b2d" stroke-width="2"/>', f'<text x="{x-8}" y="{y-23}" font-size="21" fill="{colour}">{p["ref"]}</text>'])
    status = 'LOST A–C connection' if name == 'before' else 'A–C connection preserved'
    parts.append(f'<text x="{offset+65}" y="500" font-size="22">{status}</text>')
    parts.append(f'<text x="{offset+65}" y="537" font-size="18">Aggregate opens: {row["before"]["opens"]} → {state["opens"]} · violations: {state["violations"]}</text>')
parts.extend(['<text x="40" y="605" font-size="17">Blue: retained route   Green: joined to A   Red: isolated   Dashed: removed baseline route</text>', '</g></svg>'])
(HERE / 'comparison.svg').write_text('\n'.join(parts))
