"""Plot non-overlapping self samples; inclusive stacks cannot be added."""
from pathlib import Path
from html import escape
import json, sys
data = json.loads(Path(sys.argv[1]).read_text())
rows = data['top_self'][:8]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="white"/>',
       '<g font-family="sans-serif" fill="#172b4d"><text x="35" y="45" font-size="27">Complete-board CPU profile: boundary geometry leads self samples</text>',
       '<text x="35" y="79" font-size="18">Aquarius J4 • one production replay • no speedup claim • session and stats identical</text>']
for i, row in enumerate(rows):
    y = 125 + i * 53
    width = row['ms'] / rows[0]['ms'] * 650
    svg += [f'<text x="35" y="{y+20}" font-size="19">{escape(row["function"] or "(anonymous)")}</text>',
            f'<rect x="270" y="{y}" width="{width:.3f}" height="29" fill="#356c9b"/>',
            f'<text x="{280+width:.3f}" y="{y+21}" font-size="18">{row["ms"]/1000:.2f} s</text>']
svg += ['<text x="35" y="590" font-size="18">Self sampled elapsed time; shared host; profiling overhead included. Native DRC was not rerun.</text></g></svg>']
Path(sys.argv[2]).write_text('\n'.join(svg)+'\n')
