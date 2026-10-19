from pathlib import Path
import json
p=Path(__file__).resolve().parent
rows=json.loads((p/'engine-results.json').read_text())['rows']; native=json.loads((p/'native-summary.json').read_text())
assert [r['after']['incompletes'] for r in rows]==[1,0,0]*3
assert [r['opens'] for r in native]==[1,0]*3
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="460" viewBox="0 0 1100 460"><rect width="1100" height="460" fill="#101c2b"/><g font-family="sans-serif" fill="#e4eef8"><text x="42" y="48" font-size="27">One pad above its pour: target selection blocks completion</text><text x="42" y="83" font-size="17">Same host / cores 20–25 / original rules / three repeats per condition</text><text x="42" y="135" font-size="20">Reduced DSN: remaining engine opens (each repeat)</text>'''
labels=[('Original: nearest vertex outside rim',1),('Via beneath pad: geometry witness',0),('Inset vertex: diagnostic input change',0)]
for i,(label,value) in enumerate(labels):
 y=178+i*45;svg+=f'<text x="42" y="{y}" font-size="17">{label}</text><rect x="475" y="{y-19}" width="{value*460 or 3}" height="24" fill="{"#fa8a72" if value else "#76dbb5"}"/><text x="955" y="{y}" font-size="19">{value}</text>'
svg+='''<text x="42" y="333" font-size="20">Complete native board: original 1 open → via witness 0 opens</text><text x="42" y="367" font-size="18">Native errors: 0 → 0, all three repeats (10.0.6, fresh refill)</text><text x="42" y="415" font-size="17">Diagnostics only. No production fix or frozen benchmark score change.</text></g></svg>'''
(p/'comparison.svg').write_text(svg)
