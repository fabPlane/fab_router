from pathlib import Path
import json,subprocess
p=Path(__file__).resolve().parent
d=json.loads((p/'summary.json').read_text());names=['collect','aStarLayered','test','withinRim','partWithinRim','coreOf','barrelFits','sweepClear','sort']
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><rect width="1200" height="760" fill="white"/><g font-family="sans-serif" fill="#0f172a">','<text x="35" y="45" font-size="27">L3 diagnostic CPU profiles: one route per source</text>','<text x="35" y="78" font-size="17">Self-sampled CPU seconds; inlining changes attribution. No wall-time improvement claim.</text>']
for i,name in enumerate(names):
 y=125+i*62;s.append(f'<text x="35" y="{y+20}" font-size="18">{name}</text>')
 for j,mode in enumerate(['original','candidate']):
  value=sum(r['self_sample_ms'] for r in d[mode] if r['function']==name)/1000
  color=['#64748b','#0891b2'][j];yy=y+j*23
  s.append(f'<rect x="235" y="{yy}" width="{value*36}" height="19" fill="{color}"/><text x="{245+value*36}" y="{yy+16}" font-size="16">{value:.2f}</text>')
s+=['<text x="35" y="710" font-size="18" fill="#64748b">Control (upper bars)</text>','<text x="315" y="710" font-size="18" fill="#0891b2">Rim traversal (lower bars)</text>','<text x="35" y="742" font-size="17">Identical sessions and non-timing reports; 153 engine incomplete each. No fresh native DRC.</text>','</g></svg>']
(p/'profile.svg').write_text('\n'.join(s));subprocess.run(['rsvg-convert','-w','1600',p/'profile.svg','-o',p/'profile.png'],check=True)
