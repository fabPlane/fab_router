"""Render complete native-search results and discovery layer allocation."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'native/summary.json').read_text());rank=json.loads((x.out/'ranking.json').read_text())
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720"><rect width="1400" height="720" fill="#f8fafc"/>']
def text(a,b,t,size=24):s.append(f'<text x="{a}" y="{b}" font-family="sans-serif" font-size="{size}" fill="#172033">{t}</text>')
text(55,65,'Complete Aquarius output: layer-aware thermal search',34)
text(55,110,'Native 10.0.6 / same board and rules / 3 independent repeats',23)
text(260,150,'Before search',20);text(680,150,'Published output',20)
for i,r in enumerate(z['rows']):
 attempts=[a for stage in r['stages'] for a in stage['attempts']];accepted=[a for a in attempts if a['accepted']]
 before=r['baseline'];after=accepted[-1]['row'] if r['clean'] else before;y=190+90*i
 text(55,y,f'Repeat {i+1}');text(260,y,f'{len(before["errors"])} errors / {before["opens"]} opens');text(680,y,f'{len(after["errors"])} errors / {after["opens"]} opens')
 text(260,y+33,f'{len(attempts)} proposals; {len(accepted)} intermediate acceptances; clean: {r["clean"]}',19)
text(55,480,'Discovery: '+str(rank['wrong_layer_segments'])+'/8 selected tracks differ from nearest thermal layer',25)
for i,r in enumerate(rank['ranked_segments']):
 color='#e05252' if not r['same_layer'] else '#35a68a';a=55+155*i
 s.append(f'<rect x="{a}" y="515" width="125" height="50" rx="5" fill="{color}"/>');text(a+28,550,r['layer'],22)
text(55,620,'Rejected search preserves exact initial bytes; remaining thermal failures unresolved',23)
text(55,673,'Offline diagnostic only; production routing and historical suite score unchanged',22)
s.append('</svg>');(x.out/'comparison.svg').write_text(''.join(s))
subprocess.run(['rsvg-convert','-w','1600',str(x.out/'comparison.svg'),'-o',str(x.out/'comparison.png')],check=True,timeout=120)
