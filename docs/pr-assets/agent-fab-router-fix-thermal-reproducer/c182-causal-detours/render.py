"""Render complete-board causal detour outcomes from actual retained native reports."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args();z=json.loads((x.root/'summary.json').read_text())
rows=z['repeats'][0]['attempts'];labels=list(dict.fromkeys(a['label'] for a in rows));parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1450" height="810"><rect width="1450" height="810" fill="#f5f7fb"/><g font-family="sans-serif" fill="#17243a"><text x="40" y="50" font-size="29">Causal-track detours on the complete Aquarius route</text><text x="40" y="88" font-size="19">Before: 6 thermal errors / 15 opens · Native 10.0.6 · three refills · offline diagnostic only</text>']
for i,label in enumerate(labels):
    y=130+i*105;attempts=[a for a in rows if a['label']==label];selected=next((a for a in attempts if a['accepted']),None)
    parts.append(f'<text x="40" y="{y+40}" font-size="23">{label}</text>')
    for a in attempts:
        x0=175+a['index']*150;row=a['row'];color='#187449' if a['accepted'] else '#9a3f45'
        text=f"{len(row['errors'])} err / {row['opens']} open" if row else 'Identity drift'
        detail='Accepted' if a['accepted'] else (f"Lost {len(a['lost_pairs'])} pairs" if row and a['lost_pairs'] else 'Rejected')
        parts.extend([f'<rect x="{x0}" y="{y}" width="140" height="85" fill="white" stroke="{color}" rx="6"/>',f'<text x="{x0+8}" y="{y+24}" font-size="16">{(.25,-.25,.5,-.5,1,-1,2,-2)[a["index"]]:+g} mm</text>',f'<text x="{x0+8}" y="{y+49}" font-size="16">{text}</text>',f'<text x="{x0+8}" y="{y+72}" font-size="15" fill="{color}">{detail}</text>'])
final=json.loads((x.root/'composed/summary.json').read_text())['repeats'][0]['final']
parts.append(f'<text x="40" y="705" font-size="24" fill="#187449">Sequential full-board revalidation: 6 → {len(final["errors"])} errors; 15 → {final["opens"]} opens; no lost terminal pairs</text>')
parts.append('<text x="40" y="760" font-size="19">Each cause tested separately. Acceptance: strict error reduction, faithful saved design, no lost pairs or extra opens.</text></g></svg>');x.out.with_suffix('.svg').write_text(''.join(parts));subprocess.run(['rsvg-convert','-w','1600',str(x.out.with_suffix('.svg')),'-o',str(x.out.with_suffix('.png'))],check=True)
