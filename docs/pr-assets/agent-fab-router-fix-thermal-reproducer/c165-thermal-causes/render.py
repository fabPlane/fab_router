#!/usr/bin/python3
"""Render actual native F.Cu output, cropping fixed outline-relative coordinates."""
import argparse
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--singles',type=Path,required=True)
parser.add_argument('--pairs',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
args.out.mkdir(exist_ok=False,parents=True)
ns='http://www.w3.org/2000/svg'
ET.register_namespace('',ns)
root=ET.Element('{'+ns+'}svg',width='1500',height='1120',viewBox='0 0 1500 1120')
ET.SubElement(root,'rect',width='1500',height='1120',fill='#f4f6f8')
def text(x,y,label,size=23):
    node=ET.SubElement(root,'text',x=str(x),y=str(y),fill='#152033',style=f'font: {size}px sans-serif')
    node.text=label
text(35,43,'Two native thermal failures isolated from nine added copper items',29)
text(35,78,'Original board, retained copper and rules preserved; actual native F.Cu after refill; three repeats',21)
for col,title in enumerate(('Original input','Small causal subset','All nine additions')):
    text(35+col*490,120,title,25)
for row,(title,position,case,counts) in enumerate([
    ('U1.7: two added segments',(80.264,131.318),args.pairs/'1-pair-2-7',('0 errors; 2 opens','1 thermal; 3 opens','2 thermals; 0 opens')),
    ('U2.15: one added segment',(76.073,111.125),args.singles/'1-only-6',('0 errors; 2 opens','1 thermal; 2 opens','2 thermals; 0 opens')),
]):
    y=155+row*455
    text(35,y,title,23)
    for col,board in enumerate((args.singles/'1-original',case,args.singles/'1-all-added')):
        x=35+col*490
        svg=args.out/f'{row}-{col}.svg'
        command=['kicad-cli','pcb','export','svg','--layers','F.Cu','--mode-single','--page-size-mode','2','--exclude-drawing-sheet','-o',str(svg),str(board/'board.kicad_pcb')]
        result=subprocess.run(command,capture_output=True,text=True,timeout=120)
        (args.out/f'{row}-{col}.log').write_text(result.stdout+result.stderr)
        assert result.returncode==0
        native=ET.parse(svg).getroot()
        # Native export starts at the board-outline centreline minimum, derived
        # from the unchanged outline: x=40.386 mm, y=92.964 mm.
        cx,cy=position[0]-40.386,position[1]-92.964
        native.set('viewBox',f'{cx-3.2} {cy-3.2} 6.4 6.4')
        native.set('x',str(x));native.set('y',str(y+18));native.set('width','445');native.set('height','365')
        ET.SubElement(root,'rect',x=str(x),y=str(y+18),width='445',height='365',fill='white',stroke='#cbd5e1')
        root.append(native)
        text(x,y+415,counts[col],21)
text(35,1090,'Static diagnosis only. Subsets have opens; no production fix or improved router benchmark score.',21)
svg_text = ET.tostring(root,encoding='unicode')
(args.out/'comparison.svg').write_text('\n'.join(line.rstrip() for line in svg_text.splitlines())+'\n')
result=subprocess.run(['rsvg-convert','-w','1500',str(args.out/'comparison.svg'),'-o',str(args.out/'comparison.png')],capture_output=True,text=True,timeout=120)
assert result.returncode==0,result.stderr
