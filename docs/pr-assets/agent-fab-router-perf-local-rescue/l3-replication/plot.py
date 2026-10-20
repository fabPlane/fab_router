"""Render every observed timing with standard-library SVG and rsvg-convert."""
from pathlib import Path
import json,subprocess,sys
w=Path(sys.argv[1]);records=json.loads((w/'records.json').read_text())
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">','<rect width="1200" height="630" fill="white"/>','<g font-family="sans-serif" fill="#0f172a">','<text x="65" y="45" font-size="27">L3 counterbalanced replication: all six attempts</text>','<text x="65" y="78" font-size="18">Median −0.16%; p95 +6.70%; total +1.19%. Identical sessions and non-timing results.</text>']
for tick in range(0,201,40):
 y=510-tick*1.8;s += [f'<path d="M95 {y} H1150" stroke="#e2e8f0"/>',f'<text x="45" y="{y+6}" font-size="18">{tick}</text>']
for r in records:
 center=270+(r['pair']-1)*350;x=center+(-95 if r['mode']=='original' else 5);height=r['seconds']*1.8;color='#64748b' if r['mode']=='original' else '#0891b2'
 s += [f'<rect x="{x}" y="{510-height}" width="90" height="{height}" fill="{color}"/>',f'<text x="{x+45}" y="{500-height}" text-anchor="middle" font-size="18">{r["seconds"]:.2f}</text>']
for pair,order in [(1,'candidate first'),(2,'control first'),(3,'candidate first')]:
 s += [f'<text x="{270+(pair-1)*350}" y="540" text-anchor="middle" font-size="18">Pair {pair}: {order}</text>']
s += ['<text x="100" y="125" font-size="18" fill="#64748b">■ Control</text>','<text x="250" y="125" font-size="18" fill="#0891b2">■ Rim traversal</text>','<text x="65" y="585" font-size="18">Route seconds; same two-pass / 600-second settings on cores 12–19.</text>','<text x="65" y="612" font-size="18">Engine replay only; no fresh native DRC score. Shared-host observations.</text>','</g></svg>']
(w/'timings.svg').write_text('\n'.join(s)+'\n');subprocess.run(['rsvg-convert','-w','1600',w/'timings.svg','-o',w/'timings.png'],check=True)
