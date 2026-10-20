from pathlib import Path
import json,sys
s=json.loads(Path(sys.argv[1]).read_text());c=s['census']
rows=[('Bucket duplicate visits',c['duplicates']),('Unique bucket tests',c['bucketTests']),('Shelf tests',c['shelfTests'])]
maximum=max(v for _,v in rows)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="530"><rect width="1200" height="530" fill="white"/><g font-family="sans-serif" fill="#172b4d">', '<text x="35" y="45" font-size="27">Complete-board lattice candidate census</text>', '<text x="35" y="80" font-size="18">Aquarius J4 • three identical observer repeats • identical session and statistics</text>']
for i,(label,value) in enumerate(rows):
    y=120+i*80;width=620*value/maximum
    svg.extend([f'<text x="35" y="{y+25}" font-size="20">{label}</text>',f'<rect x="300" y="{y}" width="{width}" height="38" fill="#356c9b"/>',f'<text x="{310+width}" y="{y+25}" font-size="18">{value/1e6:.2f} M</text>'])
svg.extend([f'<text x="35" y="405" font-size="20">Shelf share of overlap tests: {s["shelf_test_percent"]:.1f}% • shelf hit rate: {s["shelf_hit_percent"]:.1f}%</text>', '<text x="35" y="450" font-size="18">Operation counts, not sampled seconds or a speedup. Native DRC was not rerun.</text>', '<text x="35" y="485" font-size="18">Next hypothesis: reduce per-query overhead; most queries return one item.</text></g></svg>'])
Path(sys.argv[2]).write_text('\n'.join(svg)+'\n')
