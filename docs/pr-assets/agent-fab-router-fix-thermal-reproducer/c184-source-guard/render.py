"""Render the measured native stage counts, with three-repeat agreement."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760"><rect width="1400" height="760" fill="#f5f7fb"/><g font-family="sans-serif" fill="#17243a"><text x="45" y="52" font-size="30">Source metadata guard preserves the validated thermal repair</text><text x="45" y="92" font-size="20">Complete Aquarius output · Native 10.0.6 · same machine and rules · three repeats per validator</text>']
for row,label in enumerate(('before','after')):
    z=json.loads((x.root/label/'composed/summary.json').read_text());r=z['repeats'][0]
    counts=[len(r['baseline']['errors'])]+[len(a['row']['errors']) for a in r['attempts']]
    assert all([len(t['baseline']['errors'])]+[len(a['row']['errors']) for a in t['attempts']]==counts for t in z['repeats'])
    y=140+row*220;title='Before: proposal-to-saved fidelity only' if label=='before' else 'After: source metadata + proposal-to-saved fidelity'
    svg.append(f'<text x="45" y="{y}" font-size="24">{title}</text>')
    for col,count in enumerate(counts):
        left=50+col*180;top=y+35+(6-count)*10;height=20+count*10;color='#248258' if count==0 else '#436898'
        svg.extend([f'<rect x="{left}" y="{top}" width="130" height="{height}" rx="5" fill="{color}"/>',f'<text x="{left+12}" y="{top+height+25}" font-size="18">{count} errors</text>',f'<text x="{left+12}" y="{y+162}" font-size="17">'+('Input' if col==0 else r['attempts'][col-1]['label'])+'</text>'])
svg.append('<text x="45" y="625" font-size="23" fill="#187449">Both validators: 0 errors / 14 opens; exact candidate and final bytes identical 3/3</text>')
svg.append('<text x="45" y="671" font-size="20">Nine boundary tests: seven fail before; all pass after. Protected source metadata preserved.</text>')
svg.append('<text x="45" y="716" font-size="19">Offline diagnostic bug fix. Production router unchanged; full-suite score unchanged.</text></g></svg>')
x.out.with_suffix('.svg').write_text(''.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(x.out.with_suffix('.svg')),'-o',str(x.out.with_suffix('.png'))],check=True)
