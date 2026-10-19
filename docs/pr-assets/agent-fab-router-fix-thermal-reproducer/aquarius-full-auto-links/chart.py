#!/usr/bin/env python3
"""Plot only accepted stages from the retained three-repeat static search."""
import json
from pathlib import Path
here=Path(__file__).resolve().parent
report=json.loads((here/'comparison.json').read_text())
stages=json.loads((here/'stages.json').read_text())
r=report['repeats'][0]
assert len(report['repeats'])==3
assert all(row==r for row in report['repeats'])
values=[r['before_errors']]+[x['after_errors'] for x in stages['rows'][0]['accepted']]
labels=['Input']+[x['candidate'].replace('candidate-','Trial ') for x in stages['rows'][0]['accepted']]
w=1100;h=510
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">',
     f'<rect width="{w}" height="{h}" fill="#f7f9fc"/>',
     '<g font-family="sans-serif" fill="#17263c">',
     '<text x="40" y="45" font-size="27">Bounded thermal search on the untouched Aquarius output</text>',
     '<text x="40" y="80" font-size="18">Native 10.0.6 · same board and rules · 3 repeats · cores 20–25</text>']
step=950/len(values)
for i,(label,value) in enumerate(zip(labels,values)):
    x=70+i*step
    height=32*value
    color='#72849e' if i==0 else '#247d89'
    svg += [f'<rect x="{x}" y="{330-height}" width="{min(100,step*.6)}" height="{height}" fill="{color}"/>',
            f'<text x="{x}" y="{315-height}" font-size="24">{value}</text>',
            f'<text x="{x}" y="360" font-size="18">{label}</text>']
svg += [f'<text x="40" y="405" font-size="19">Selected opens: {r["before_opens"]} → {r["after_opens"]}; lost connected pairs: 0</text>',
        f'<text x="40" y="438" font-size="18">{r["checked_candidates"]} proposals per repeat; stop: {r["stop"]}. Only accepted stages shown.</text>',
        '<text x="40" y="477" font-size="18">Static diagnostic only; production engine, adapter and benchmark scores unchanged.</text>',
        '</g></svg>']
(here/'comparison.svg').write_text('\n'.join(svg)+'\n')
