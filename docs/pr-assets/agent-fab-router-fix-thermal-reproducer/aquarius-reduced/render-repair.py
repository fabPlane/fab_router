#!/usr/bin/python3
"""Compose native copper exports around the reduced R20 repair witness."""
from pathlib import Path
import subprocess
import gzip
import tempfile
import sys
import xml.etree.ElementTree as ET
ET.register_namespace('', 'http://www.w3.org/2000/svg')
a = Path(sys.argv[1])
root = ET.Element('{http://www.w3.org/2000/svg}svg', width='1400', height='780', viewBox='0 0 1400 780')
ET.SubElement(root, 'rect', width='1400', height='780', fill='#f4f6f8')
def text(x,y,value,size=23):
    node=ET.SubElement(root,'text',x=str(x),y=str(y),fill='#152033',style=f'font: {size}px sans-serif');node.text=value
text(35,42,'R20: reduced native thermal repair witness',31)
text(35,77,'Four retained footprints; exact cropped terminal groups preserved; three repeats per board',20)
for i,label in enumerate(('before','after')):
    folder=a/f'final-1-{label}'
    with tempfile.TemporaryDirectory() as tmp:
        local=Path(tmp)/'board.kicad_pcb'
        path=folder/'board.kicad_pcb'
        local.write_bytes(path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()))
        subprocess.run(['kicad-cli','pcb','export','svg','--layers','B.Cu','--mode-multi','--page-size-mode','1','-o',tmp+'/',str(local)],check=True,capture_output=True)
        paths=list(Path(tmp).glob('*.svg'));assert len(paths)==1
        native=ET.parse(paths[0]).getroot()
    native.set('x',str(35+690*i));native.set('y','140');native.set('width','640');native.set('height','535')
    # Exports use board drawing coordinates; viewBox selects the pad and nearby obstacle.
    native.set('viewBox','171.5 54.5 7 6')
    ET.SubElement(root,'rect',x=str(35+690*i),y='140',width='640',height='535',fill='white',stroke='#ccd2da')
    root.append(native)
    text(35+690*i,120, 'Original: 1 thermal error' if i==0 else 'Track shift + endpoint links: 0 errors')
    text(35+690*i,710,'1 native open; cropped terminal inventory unchanged',19)
text(35,755,'Static diagnostic only: no routing completion gain or production repair.',20)
ET.ElementTree(root).write(a/'comparison.svg',encoding='unicode',xml_declaration=True)
path=a/'comparison.svg'
path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines())+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(a/'comparison.svg'),'-o',str(a/'comparison.png')],check=True)
