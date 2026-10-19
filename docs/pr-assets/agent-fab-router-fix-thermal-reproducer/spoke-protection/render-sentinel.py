#!/usr/bin/python3
"""Render measured native diagnostic results without external plotting packages."""
import json
from pathlib import Path
import xml.etree.ElementTree as E
p = Path(__file__).resolve().parent / 'sentinel-results'
d = json.loads((p / 'summary.json').read_text())
r = E.Element('svg', xmlns='http://www.w3.org/2000/svg', width='1500', height='470')
E.SubElement(r, 'rect', width='1500', height='470', fill='#f5f7fa')
def text(x, y, value, size=22):
    E.SubElement(r, 'text', x=str(x), y=str(y), fill='#152033', style=f'font: {size}px sans-serif').text = value
text(35, 45, 'Expected native error detects silent rule-loading fallback', 30)
text(35, 80, 'Same board/project, three fresh native 10.0.6 checks per variant; all CLI exits zero')
text(35, 130, 'Rule content')
text(650, 130, 'Sentinel errors / run')
text(1040, 130, 'Down / left samples')
for i, row in enumerate(d['rows'][:5]):
    y = 180 + i * 48
    text(35, y, row['variant'])
    E.SubElement(r, 'rect', x='650', y=str(y-23), width=str(250*row['sentinel_errors']), height='28', fill='#187b65')
    text(930, y, str(row['sentinel_errors']))
    text(1040, y, ' / '.join(str(v['count']) for v in row['snapshot']['sections'].values()))
text(35, 447, 'Diagnostic only: two opens persist; expected error is deliberate. No routing or thermal safety proof.', 20)
(p / 'comparison.svg').write_text(E.tostring(r, encoding='unicode')+'\n')
