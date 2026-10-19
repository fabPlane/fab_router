#!/usr/bin/python3
"""Compose native exports of the two routed outcomes, with measured captions."""
import pathlib
import sys
import xml.etree.ElementTree as ET

ET.register_namespace('', 'http://www.w3.org/2000/svg')
root = ET.Element('{http://www.w3.org/2000/svg}svg', width='1400', height='820', viewBox='0 0 1400 820')
ET.SubElement(root, 'rect', width='1400', height='820', fill='#f4f6f8')


def text(x, y, value, size=24):
    node = ET.SubElement(root, 'text', x=str(x), y=str(y), fill='#152033', style=f'font: {size}px sans-serif')
    node.text = value


text(40, 46, 'Protecting a thermal spoke changes the routed copper', 29)
text(40, 78, 'Same native input and rules; fixture-specific guard supplied outside DSN; three repeats each', 21)
for i, (path, title, caption) in enumerate([
    (sys.argv[1], 'Baseline: no thermal context', 'One thermal error; intended connection complete'),
    (sys.argv[2], 'Guard: native context + selected spoke', 'Zero native errors; intended connection complete'),
]):
    x = 40 + i * 690
    text(x, 128, title, 25)
    native = ET.parse(path).getroot()
    native.set('x', str(x))
    native.set('y', '150')
    native.set('width', '640')
    native.set('height', '575')
    native.set('viewBox', '3.2 3.0 4.3 4.3')
    ET.SubElement(root, 'rect', x=str(x), y='150', width='640', height='575', fill='white', stroke='#ccd2da')
    root.append(native)
    text(x, 755, caption, 20)
text(40, 795, 'One unrelated native open remains in both. Prototype only; general thermal safety remains unresolved.', 19)
svg = ET.tostring(root, encoding='unicode')
pathlib.Path(sys.argv[3]).write_text('\n'.join(line.rstrip() for line in svg.splitlines()) + '\n')
