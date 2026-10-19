"""Plot measured stages; regenerate from the retained native summary."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'summary.json').read_text());r=z['repeats'][0]
counts=[len(r['baseline']['errors'])]+[len(a['row']['errors']) for a in r['attempts'] if a['accepted']]
assert all([len(t['baseline']['errors'])]+[len(a['row']['errors']) for a in t['attempts'] if a['accepted']]==counts for t in z['repeats'])
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="650"><rect width="1400" height="650" fill="#f5f7fb"/><g font-family="sans-serif" fill="#17243a"><text x="45" y="55" font-size="30">Native-marker discovery without board-specific cause identifiers</text><text x="45" y="100" font-size="21">Complete Aquarius output · Native 10.0.6 · same rules / machine · three fresh repeats</text>']
for i,count in enumerate(counts):
    left=50+i*180;top=175+(6-count)*25;height=35+count*25
    svg.append(f'<rect x="{left}" y="{top}" width="130" height="{height}" rx="5" fill="'+('#248258' if count==0 else '#436898')+'"/>')
    svg.append(f'<text x="{left}" y="410" font-size="20">{count} error{"" if count==1 else "s"}</text><text x="{left}" y="445" font-size="18">'+('Source' if i==0 else f'Accepted {i}')+'</text>')
svg.append(f'<text x="45" y="505" font-size="22">{len(r["pool"])} marker-near candidates; {len(r["causes"])} deletion causes; {r["final"]["opens"]} opens after sequential validation</text>')
svg.append('<text x="45" y="550" font-size="21">Every accepted repair preserves terminal pairs, original copper, source metadata and rules.</text><text x="45" y="600" font-size="20">Offline diagnostic only. Production thermal failures and full-suite score remain unresolved.</text></g></svg>')
x.out.with_suffix('.svg').write_text(''.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(x.out.with_suffix('.svg')),'-o',str(x.out.with_suffix('.png'))],check=True)
