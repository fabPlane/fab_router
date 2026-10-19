import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'native/summary.json').read_text())
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620"><rect width="1400" height="620" fill="#f8fafc"/>']
def text(x,y,t,size=25):s.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#172033">{t}</text>')
text(55,65,'Marker-guided track pair discovery: J2-small',34)
text(55,110,'Same board and rules / native 10.0.6 / three independent repeats',23)
for i,(label,baseline) in enumerate([('Before corner search',True),('After corner search',False)]):
 rows=[r['baseline'] if baseline or not r['accepted'] else r['attempts'][-1]['row'] for r in z['rows']]
 counts={(len(r['errors']),r['opens']) for r in rows};assert len(counts)==1
 errors,opens=counts.pop();y=210+120*i
 text(55,y,label);text(560,y,f'{errors} native errors');text(960,y,f'{opens} opens / 3 repeats')
 s.append(f'<rect x="560" y="{y+14}" width="{120*errors}" height="15" fill="#e05252"/>')
n=len(z['rows'][0]['attempts']);accepted=sum(r['accepted'] for r in z['rows'])
text(55,490,f'{n} proposals per repeat; {accepted}/3 accepted; fixed outer endpoints',25)
text(55,560,'Offline diagnostic only; production routing and historical suite score unchanged',22)
s.append('</svg>');x.out.mkdir(parents=True,exist_ok=True)
(x.out/'comparison.svg').write_text(''.join(s))
subprocess.run(['rsvg-convert','-w','1600',str(x.out/'comparison.svg'),'-o',str(x.out/'comparison.png')],check=True,timeout=120)
