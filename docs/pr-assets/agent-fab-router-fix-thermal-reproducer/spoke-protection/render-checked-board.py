#!/usr/bin/python3
"""Render measured checked-board receipt controls."""
import json
from pathlib import Path
import xml.etree.ElementTree as E
p = Path(__file__).resolve().parent / 'checked-board-results'
d = json.loads((p / 'summary.json').read_text())
r = E.Element('svg', xmlns='http://www.w3.org/2000/svg', width='1500', height='440')
E.SubElement(r, 'rect', width='1500', height='440', fill='#f5f7fa')
def text(x, y, value, size=22):
    E.SubElement(r, 'text', x=str(x), y=str(y), fill='#152033', style=f'font: {size}px sans-serif').text = value
text(30, 45, 'Bind offline acceptance to the checked board and report bytes', 30)
text(30, 82, 'Same miniature / host / cores 20–25; three repeats per fault; fresh native checks')
for x, label in ((30, 'After validation'), (440, 'Rechecked errors'), (790, 'Previous decision'), (1160, 'Receipt decision')):
    text(x, 135, label)
for i, row in enumerate(d['rows'][:4]):
    y = 185 + 48*i
    for x, value in ((30, row['variant']), (440, str(row['decision_board_errors'])),
                     (790, 'accept' if row['previous_decision'] else 'reject'),
                     (1160, 'accept' if row['accepted'] else 'reject')):
        text(x, y, value)
text(30, 385, 'Unsafe replacement has one thermal error in every repeat. All original files unchanged.', 21)
text(30, 422, 'Fixture evidence only: final hash checks provide no atomic publication or editor ownership.', 21)
(p / 'comparison.svg').write_text(E.tostring(r, encoding='unicode')+'\n')
