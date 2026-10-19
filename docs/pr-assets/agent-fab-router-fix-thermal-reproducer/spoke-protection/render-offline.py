#!/usr/bin/python3
"""Render measured offline native acceptance controls."""
import json
from pathlib import Path
import xml.etree.ElementTree as E
p = Path(__file__).resolve().parent / 'offline-results'
d = json.loads((p / 'summary.json').read_text())
r = E.Element('svg', xmlns='http://www.w3.org/2000/svg', width='1500', height='440')
E.SubElement(r, 'rect', width='1500', height='440', fill='#f5f7fa')
def text(x, y, value, size=22):
    E.SubElement(r, 'text', x=str(x), y=str(y), fill='#152033', style=f'font: {size}px sans-serif').text = value
text(30, 45, 'Offline native candidate acceptance on staged files', 30)
text(30, 82, 'Same miniature / host / cores 20–25; three fresh checks per candidate; no routing rerun')
for x, label in ((30, 'Candidate'), (390, 'Native errors'), (650, 'Loading observed'), (970, 'Project present'), (1250, 'Decision')):
    text(x, 135, label)
for i, row in enumerate(d['rows'][:4]):
    y = 185 + 48*i
    for x, value in ((30, row['variant']), (390, str(row['candidate_errors'])),
                     (650, str(row['loading_observed'])), (970, str(row['project_present'])),
                     (1250, 'accept' if row['accepted'] else 'reject')):
        text(x, y, value)
text(30, 385, 'Original source files unchanged in all 12 checks. Candidate boards still have one native open.', 21)
text(30, 422, 'Fixture diagnostic: no live ownership, atomic publication, general rule validation or production safety proof.', 20)
(p / 'comparison.svg').write_text(E.tostring(r, encoding='unicode')+'\n')
