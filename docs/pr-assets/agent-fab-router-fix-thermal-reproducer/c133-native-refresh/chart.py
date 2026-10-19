#!/usr/bin/env python3
"""Render native outcome counts; convert SVG with rsvg-convert."""
import json
from pathlib import Path

here = Path(__file__).resolve().parent
report = json.loads((here / 'comparison.json').read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440" viewBox="0 0 1100 440">',
       '<rect width="1100" height="440" fill="#f7f9fc"/>',
       '<g font-family="sans-serif" fill="#17263c">',
       '<text x="40" y="45" font-size="26">Native full-suite refresh: unchanged engine</text>',
       '<text x="40" y="75" font-size="17">26 cases × 3 repeats · same host · different CPU affinity · no speed claim</text>']
for i, (key, label, maximum) in enumerate((('passed', 'Passing runs / 78', 78),
                                        ('valid_cases', 'Valid cases / 26', 26),
                                        ('opens', 'Total native opens', 120),
                                        ('new_errors', 'New thermal errors', 27))):
    x = 45 + i * 270
    svg.append(f'<text x="{x}" y="120" font-size="18">{label}</text>')
    for j, (source, color, title) in enumerate((('before', '#6d829e', 'Reference'),
                                               ('after', '#247d89', 'Refresh'))):
        value = report[source][key]
        height = 170 * value / maximum
        bx = x + j * 105
        svg.append(f'<rect x="{bx}" y="{325-height}" width="75" height="{height}" fill="{color}"/>')
        svg.append(f'<text x="{bx+37.5}" y="{315-height}" text-anchor="middle" font-size="22">{value}</text>')
        svg.append(f'<text x="{bx}" y="350" font-size="15">{title}</text>')
svg += ['<text x="40" y="401" font-size="18">Thermal failures remain unresolved. Offline repairs are excluded from the benchmark.</text>', '</g></svg>']
(here / 'comparison.svg').write_text('\n'.join(svg) + '\n')
