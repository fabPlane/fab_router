from pathlib import Path
import json,subprocess,sys
results,out=map(Path,sys.argv[1:]);r=json.loads(results.read_text())['rows'][0]['result']
assert (r['work'],r['enumeration'])==(18890,124)
parts=[(r['attempts'][0]['result']['expansions'],'#426b9d','Original search: 14,509'),(r['enumeration'],'#ad771a','Enumeration: 124'),(r['attempts'][1]['result']['expansions'],'#37876c','Alternate: 4,257')]
elements=[];x=70
for amount,color,label in parts:
 width=1000*amount/r['work'];elements.append(f'<rect x="{x}" y="135" width="{width}" height="55" fill="{color}"/>');x+=width
for index,(_,color,label)in enumerate(parts):
 elements.append(f'<rect x="{70+index*345}" y="225" width="18" height="18" fill="{color}"/><text x="{98+index*345}" y="240">{label}</text>')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="440" viewBox="0 0 1160 440">
<rect width="1160" height="440" fill="#f7f9fb"/><g font-family="sans-serif" fill="#203044" font-size="21">
<text x="70" y="55" font-size="30" font-weight="bold">One shared budget closes the saved stall</text>
<text x="70" y="95">Three static replays: identical copper and charged search traces</text>
{''.join(elements)}
<text x="70" y="305">18,889 units: exhausted, original session restored</text>
<text x="70" y="350" font-weight="bold">18,890 units: original connection closed, exact violations 0</text>
<text x="70" y="400" font-size="17">Offline policy experiment. No fresh native check or end-to-end speed claim.</text>
</g></svg>'''
out.with_suffix('.svg').write_text(svg)
subprocess.run(['rsvg-convert','-w','1600',str(out.with_suffix('.svg')),'-o',str(out)],check=True)
