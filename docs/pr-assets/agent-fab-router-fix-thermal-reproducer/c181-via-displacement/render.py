"""Render measured per-offset native errors, opens and acceptance."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--summary',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads(x.summary.read_text());parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="650"><rect width="1500" height="650" fill="#f4f7fb"/><g font-family="sans-serif" fill="#16243a"><text x="40" y="55" font-size="30">Connected via displacement: reduced witness and complete route</text><text x="40" y="90" font-size="19">Native 10.0.6 · same source/rules/machine · three repeats per offset · diagnostic only</text>']
for i,label in enumerate(('reduced','full')):
    y=140+i*210
    parts.append(f'<text x="40" y="{y}" font-size="24">{label.title()}</text>')
    for index,r in enumerate(v for v in z['rows'] if v['label']==label and v['repeat']==0):
        x0=45+index*160
        color='#197047' if r['accepted'] else '#963b42'
        row=r['row'];value=f"{len(row['errors'])} errors" if row else 'Identity drift'
        details=f"{row['opens']} opens" if row else 'Excluded'
        parts.extend([f'<rect x="{x0}" y="{y+20}" width="145" height="135" rx="8" fill="white" stroke="{color}"/>',f'<text x="{x0+10}" y="{y+50}" font-size="18">{r["offset"]} mm</text>',f'<text x="{x0+10}" y="{y+83}" font-size="20" fill="{color}">{value}</text>',f'<text x="{x0+10}" y="{y+111}" font-size="18">{details}</text>',f'<text x="{x0+10}" y="{y+140}" font-size="16">'+('Accepted' if r['accepted'] else 'Control / rejected')+'</text>'])
parts.append('<text x="40" y="605" font-size="20">Acceptance requires fewer native errors, no lost terminal pairs, no additional opens and unchanged design identity.</text></g></svg>')
x.out.with_suffix('.svg').write_text(''.join(parts))
subprocess.run(['rsvg-convert','-w','1600',str(x.out.with_suffix('.svg')),'-o',str(x.out.with_suffix('.png'))],check=True)
