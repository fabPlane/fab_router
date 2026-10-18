"""Compose unchanged native front-copper exports at identical coordinates and scale."""
from pathlib import Path
import xml.etree.ElementTree as ET
import subprocess
p = Path(__file__).resolve().parent
ns = 'http://www.w3.org/2000/svg'
ET.register_namespace('', ns)
def tag(n): return '{' + ns + '}' + n
out = ET.Element(tag('svg'), width='1600', height='640', viewBox='0 0 1600 640')
ET.SubElement(out, tag('rect'), width='1600', height='640', fill='#ffffff')
for i, label in enumerate(['before', 'after']):
    title = ET.SubElement(out, tag('text'), x=str(30 + 800 * i), y='45', fill='#142235', attrib={'font-size':'24', 'font-family':'sans-serif'})
    title.text = f'{label.title()}: rufs J3 — ' + ('1 native open' if i == 0 else '0 native opens')
    svg = ET.parse(p / ('native-' + label + '.svg')).getroot()
    svg.attrib.update(x=str(i*800+20), y='65', width='760', height='500', viewBox='61 80 9 6')
    out.append(svg)
text = ET.SubElement(out, tag('text'), x='30', y='610', fill='#142235', attrib={'font-size':'22','font-family':'sans-serif'})
text.text = 'Native F.Cu at equal scale; full-width power track overlaps the middle pad beyond its edge.'
ET.ElementTree(out).write(p / 'native-comparison.svg', encoding='unicode')
subprocess.run(['rsvg-convert', '-w', '1600', str(p / 'native-comparison.svg'), '-o', str(p / 'native-comparison.png')], check=True)
