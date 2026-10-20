from pathlib import Path
import json,subprocess
p=Path(__file__).parent;rows=json.loads((p/'summary.json').read_text())
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="460"><rect width="1200" height="460" fill="white"/><g font-family="sans-serif" fill="#182d42"><text x="40" y="45" font-size="26">Lattice shape provenance in convex core conversions</text><text x="40" y="78" font-size="17">One diagnostic replay per case; no measured speed or native DRC gain</text>']
for i,r in enumerate(rows):
 y=130+i*90;owned=sum(v['calls'] for v in r['rows'].values());pc=100*owned/r['totals']['calls']
 s += [f'<text x="40" y="{y}" font-size="18">{r["case"]}</text>',f'<rect x="440" y="{y-20}" width="560" height="30" fill="#d9e0e6"/>',f'<rect x="440" y="{y-20}" width="{5.6*pc}" height="30" fill="#26769c"/>',f'<text x="1020" y="{y}" font-size="20">{pc:.2f}%</text>',f'<text x="440" y="{y+33}" font-size="16">{owned:,} lattice-provenance / {r["totals"]["calls"]:,} total calls</text>']
s+=['<text x="40" y="430" font-size="17">No observed core changes; mutation probe demonstrates shared track endpoint aliases.</text></g></svg>']
(p/'ownership.svg').write_text(''.join(s));subprocess.run(['rsvg-convert','-w','1600',str(p/'ownership.svg'),'-o',str(p/'ownership.png')],check=True)
