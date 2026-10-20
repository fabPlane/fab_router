from pathlib import Path
import json,subprocess
p=Path(__file__).resolve().parent
s=json.loads((p/'summary.json').read_text())
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420"><rect width="1200" height="420" fill="white"/><g font-family="sans-serif" fill="#18293b"><text x="35" y="40" font-size="25">Raw query recurrence within a mutation epoch</text><text x="35" y="72" font-size="17">Diagnostic only · 256-entry LRU · one default-settings replay per case</text>']
for i,(case,r) in enumerate(s.items()):
 y=125+85*i;v=r['raw_recurrence_percent']
 svg.append(f'<text x="35" y="{y}" font-size="16">{case}</text><rect x="35" y="{y+12}" width="{v*9}" height="25" fill="#258a9a"/><text x="{45+v*9}" y="{y+32}" font-size="16">{v:.3f}% ({r["counts"]["lruHits"]:,} / {r["counts"]["queries"]:,})</text>')
svg.append('<text x="35" y="395" font-size="16">Counts include filtered requests; recurrence does not establish safe cache hits or a speed benefit.</text></g></svg>')
(p/'recurrence.svg').write_text(''.join(svg));subprocess.run(['rsvg-convert',str(p/'recurrence.svg'),'-o',str(p/'recurrence.png')],check=True)
