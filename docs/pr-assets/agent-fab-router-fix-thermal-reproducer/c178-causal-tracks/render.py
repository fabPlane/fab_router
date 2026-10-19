#!/usr/bin/python3
"""Render measured causal matrix; deletion is diagnostic only."""
import argparse, html, json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--findings',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads(x.findings.read_text())
pads={f['pad']:f['label'] for f in z['findings']}
causes=[(c,{f['pad']}) for f in z['findings'] for c in f['causes']]
w=1300;h=220+32*len(causes)
s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',f'<rect width="{w}" height="{h}" fill="#f5f7fb"/>']
def t(x,y,text,size=17,color='#182b49'):
 s.append(f'<text x="{x}" y="{y}" font-family="DejaVu Sans" font-size="{size}" fill="{color}">{html.escape(str(text))}</text>')
t(30,38,'Complete Aquarius board: causal generated-copper deletions',25)
t(30,68,'Native 10.0.6, same board/rules, three repeats; all other design nodes retained')
t(30,96,f"{z['track_candidates_per_repeat']} tracks + {z['via_candidates_per_repeat']} C1-near vias tested per repeat; baseline: 6 thermal errors, 15 opens")
t(30,137,'Deleted copper UUID',16)
for j,pad in enumerate(pads):t(460+90*j,137,pads[pad],15)
t(1020,137,'Opens',15);t(1100,137,'Lost pairs',15)
for i,(a,removed) in enumerate(causes):
 y=173+32*i;t(30,y,a['item'],14)
 for j,pad in enumerate(pads):
  color='#137e66' if pad in removed else '#dce3ed'
  s.append(f'<rect x="{460+90*j}" y="{y-19}" width="66" height="25" rx="4" fill="{color}"/>')
  if pad in removed:t(477+90*j,y,'gone',12,'#ffffff')
 t(1020,y,a['opens'],15);t(1100,y,a['lost_pairs'],15)
t(30,h-38,'Green: native thermal error disappears. Deletion can disconnect routing; this is not a repair.',16)
s.append('</svg>');x.out.write_text('\n'.join(s)+'\n')
print(json.dumps(dict(causal_items=len(causes),markers=list(pads.values())),indent=2))
