"""Render observed counts without external Python packages."""
from pathlib import Path
import json,subprocess
p=Path(__file__).resolve().parent
s=json.loads((p/'summary.json').read_text())
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="530"><rect width="1100" height="530" fill="white"/><g font-family="sans-serif" fill="#172b4d"><text x="30" y="40" font-size="25">Complete-board segment threshold opportunities</text><text x="30" y="75" font-size="18">14,888,532 comparisons per replay; three identical replays. No speed prediction.</text>']
for i,(label,count) in enumerate(s['stages'].items()):
    y=105+i*47
    svg.append(f'<text x="30" y="{y+22}" font-size="18">{label}</text><rect x="240" y="{y}" width="{count/max(s["stages"].values())*620:.3f}" height="30" fill="#3677aa"/><text x="880" y="{y+22}" font-size="18">{count:,}</text>')
svg.append('<text x="30" y="480" font-size="17">8,460,060 endpoint evaluations potentially avoidable (20.08% of endpoint work).</text><text x="30" y="510" font-size="17">Counts exclude dispatch cost and non-segment comparisons; no native DRC claim.</text></g></svg>')
(p/'chart.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert',str(p/'chart.svg'),'-o',str(p/'chart.png')],check=True)
