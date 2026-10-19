"""Render operation counts, never timing estimates."""
from pathlib import Path
from collections import Counter
import json,sys
p=Path(sys.argv[1]);s=json.loads((p/'summary.json').read_text());c=s['census']
rows=['| Obstacle category | Candidate calls | Blocked returns | Convex comparisons |','|---|---:|---:|---:|']
pairs=Counter()
for key,value in c['pairs'].items():pairs[key.split(':')[0]]+=value
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480"><rect width="1200" height="480" fill="white"/><text x="25" y="35" font-size="22">Complete-board exact comparison census (one replay; three identical repeats)</text>']
for i,(cat,count) in enumerate(sorted(c['calls'].items())):
 rows.append(f'| {cat} | {count:,} | {c["blocked"].get(cat,0):,} | {pairs[cat]:,} |')
 y=85+52*i
 svg.append(f'<text x="25" y="{y}" font-size="18">{cat}</text><rect x="180" y="{y-22}" width="{pairs[cat]/max(pairs.values())*700:.3f}" height="30" fill="#287b96"/><text x="910" y="{y}" font-size="18">{pairs[cat]:,}</text>')
svg.append('<text x="25" y="450" font-size="17">Bars: convex comparisons inside hitBlocks; counts include all route phases. No speed or native safety claim.</text></svg>')
(p/'census.svg').write_text(''.join(svg)+'\n')
rows+=['','| Subject : obstacle : comparison | Count |','|---|---:|']
for k,v in sorted(c['pairs'].items(),key=lambda kv:(-kv[1],kv[0])):rows.append(f'| {k} | {v:,} |')
(p/'table.md').write_text('\n'.join(rows)+'\n')
