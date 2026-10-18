"""Render the minimized regression's imported layer/track geometry (no dependencies)."""
from pathlib import Path
import subprocess
out = Path(__file__).parent
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520">', '<rect width="1100" height="520" fill="#101923"/>', '<g font-family="sans-serif" fill="#e6edf3">', '<text x="40" y="42" font-size="25">Session layer aliases: Top / Bottom on a top / bottom board</text>']
for x, title, fixed in [(40, 'Before: 0 of 4 wires imported', False), (570, 'After: 4 of 4 wires imported', True)]:
    parts.append(f'<text x="{x}" y="98" font-size="21">{title}</text>')
    for row, (name, color) in enumerate([('top', '#ef8c7e'), ('bottom', '#75baff')]):
        y = 145 + row * 155
        parts.append(f'<text x="{x}" y="{y}" font-size="19">Layer: {name}</text><rect x="{x}" y="{y+15}" width="470" height="105" rx="8" fill="#1d2b38"/>')
        for j in range(2):
            yy = y + 43 + j * 45
            parts.append(f'<path d="M {x+85} {yy} H {x+370}" stroke="{color}" stroke-width="8" opacity="{1 if fixed else .18}" stroke-dasharray="{0 if fixed else 12}"/>')
    parts.append(f'<text x="{x}" y="490" font-size="17">{"Aliases resolve to the first and last layer" if fixed else "Case-insensitive existence check suppresses aliases"}</text>')
parts.append('</g></svg>')
(out/'layer-alias.svg').write_text(''.join(parts))
subprocess.run(['rsvg-convert', '-w', '1600', str(out/'layer-alias.svg'), '-o', str(out/'layer-alias.png')], check=True)
