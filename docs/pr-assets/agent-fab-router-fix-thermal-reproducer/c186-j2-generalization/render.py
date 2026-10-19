"""Render actual retained native stage counts, without implying a routing score."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'summary.json').read_text());rows=z['repeats']
counts=[len(rows[0]['baseline']['errors'])]+[len(a['row']['errors']) for a in rows[0]['attempts'] if a['accepted']]
assert all([len(r['baseline']['errors'])]+[len(a['row']['errors']) for a in r['attempts'] if a['accepted']]==counts for r in rows)
assert len(rows)==3 and all(r['final']['opens']==0 and r['complete'] for r in rows)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#f5f7fb"/><g font-family="sans-serif" fill="#17243a"><text x="45" y="55" font-size="30">Marker-driven search also clears the complete J2small witness</text><text x="45" y="100" font-size="22">Same source / rules / machine · Native 10.0.6 · three fresh repeats</text>']
for i,n in enumerate(counts):
 left=70+i*360;height=60+65*n;top=355-height
 svg.append(f'<rect x="{left}" y="{top}" width="220" height="{height}" rx="6" fill="'+('#248258' if n==0 else '#436898')+'"/>')
 svg.append(f'<text x="{left}" y="395" font-size="23">{n} error{"" if n==1 else "s"} / 0 opens</text><text x="{left}" y="430" font-size="20">'+('Source' if i==0 else f'Accepted detour {i}')+'</text>')
svg.append('<text x="45" y="500" font-size="22">Eight candidates; two deletion causes; no supplied cause IDs or pair repair needed.</text><text x="45" y="550" font-size="20">Offline native experiment. Production thermal failures and suite score remain unresolved.</text></g></svg>')
x.out.with_suffix('.svg').write_text(''.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(x.out.with_suffix('.svg')),'-o',str(x.out.with_suffix('.png'))],check=True)
