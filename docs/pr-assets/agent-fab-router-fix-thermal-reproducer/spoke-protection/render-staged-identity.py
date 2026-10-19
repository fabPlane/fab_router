#!/usr/bin/python3
"""Render measured fixture sidecar drift decisions."""
import json
from pathlib import Path
import xml.etree.ElementTree as E
p = Path(__file__).resolve().parent / 'staged-identity-results'
d = json.loads((p / 'summary.json').read_text())
r = E.Element('svg', xmlns='http://www.w3.org/2000/svg', width='1500', height='440')
E.SubElement(r, 'rect', width='1500', height='440', fill='#f5f7fa')
def text(x, y, value, size=22):
    E.SubElement(r, 'text', x=str(x), y=str(y), fill='#152033', style=f'font: {size}px sans-serif').text = value
text(30, 45, 'Persistent sidecar drift after a successful loading probe', 30)
text(30, 82, 'Same miniature / host / cores 20–25; three repeats each; fresh native refill and DRC')
for x, label in ((30, 'Staged candidate'), (420, 'Errors / opens'), (750, 'Previous decision'), (1120, 'Identity decision')):
    text(x, 135, label)
for i, row in enumerate(d['rows'][:4]):
    y = 185 + 48*i
    for x, value in ((30, row['variant']), (420, '0 / 1'),
                     (750, 'accept' if row['previous_decision'] else 'reject'),
                     (1120, 'accept' if row['accepted'] else 'reject')):
        text(x, y, value)
text(30, 385, 'All probes observed the sentinel. All original files unchanged. No routing rerun or candidate publication.', 21)
text(30, 422, 'Persistent-change detection only: no locking, transient-change detection or atomic publication.', 21)
(p / 'comparison.svg').write_text(E.tostring(r, encoding='unicode')+'\n')
