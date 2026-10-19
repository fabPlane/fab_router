#!/usr/bin/python3
"""Compose actual native B.Cu SVG exports; no geometry is reconstructed."""
import pathlib, sys, xml.etree.ElementTree as ET
ET.register_namespace('', 'http://www.w3.org/2000/svg')
root = ET.Element('{http://www.w3.org/2000/svg}svg', width='1400', height='820', viewBox='0 0 1400 820')
ET.SubElement(root, 'rect', width='1400', height='820', fill='#f4f6f8')
def text(x,y,value,size=24):
    node=ET.SubElement(root,'text',x=str(x),y=str(y),fill='#152033',style=f'font: {size}px sans-serif');node.text=value
text(40,46,'Native refill: thermal-spoke starvation',32)
text(40,78,'Aquarius U1.39: rounded pad at 315 degrees, B.Cu; native version 10.0.6',21)
for i,(path,title,sub) in enumerate([(sys.argv[1],'All three tracks','1 spoke / 2 required: native thermal error'),(sys.argv[2],'Deletion control: first track removed','No thermal error; diagnostic control only')]):
    x=40+i*690
    text(x,128,title,25)
    native=ET.parse(path).getroot()
    native.set('x',str(x));native.set('y','150');native.set('width','640');native.set('height','575')
    native.set('viewBox','56 12 8 7')
    ET.SubElement(root,'rect',x=str(x),y='150',width='640',height='575',fill='white',stroke='#ccd2da')
    root.append(native)
    text(x,755,sub,21)
text(40,795,'Native copper after refill. Each of the three single-track deletions clears the error; no routing fix.',19)
ET.ElementTree(root).write(pathlib.Path(sys.argv[3]),encoding='unicode',xml_declaration=True)
