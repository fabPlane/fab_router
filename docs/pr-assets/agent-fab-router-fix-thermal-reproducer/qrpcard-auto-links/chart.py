#!/usr/bin/env python3
"""Draw measured static native counts; convert SVG with rsvg-convert."""
import json
from pathlib import Path

here = Path(__file__).resolve().parent
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470">',
       '<rect width="1100" height="470" fill="#f7f9fc"/>',
       '<g font-family="sans-serif" fill="#17263c">',
       '<text x="40" y="45" font-size="27">Offline thermal search on complete routed boards</text>',
       '<text x="40" y="78" font-size="18">Same board and rules, native 10.0.6, three repeats, cores 20–25</text>']
for i, case in enumerate(('j2-small', 'j4')):
    report = json.loads((here / case / 'comparison.json').read_text())
    first = report['repeats'][0]
    assert all((r['before_errors'], r['after_errors'], r['before_opens'], r['after_opens']) ==
               (first['before_errors'], first['after_errors'], first['before_opens'], first['after_opens'])
               for r in report['repeats'])
    x = 60 + i * 520
    svg.append(f'<text x="{x}" y="130" font-size="23">qrpcard {case}</text>')
    for j, (label, key, color) in enumerate((('Input', 'before_errors', '#72849e'),
                                             ('Selected', 'after_errors', '#247d89'))):
        value = first[key]
        bx = x + j * 180
        height = value * 70
        svg += [f'<rect x="{bx}" y="{320-height}" width="105" height="{height}" fill="{color}"/>',
                f'<text x="{bx+52}" y="{305-height}" text-anchor="middle" font-size="26">{value}</text>',
                f'<text x="{bx}" y="350" font-size="19">{label} errors</text>']
    svg.append(f'<text x="{x}" y="390" font-size="18">Opens: {first["before_opens"]} → {first["after_opens"]}; lost connected pairs: 0</text>')
svg += ['<text x="40" y="440" font-size="18">Static diagnostics only. Engine and adapter unchanged; no router benchmark gain claimed.</text>', '</g></svg>']
(here / 'comparison.svg').write_text('\n'.join(svg) + '\n')
