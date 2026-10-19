import json, html, gzip
from pathlib import Path
root=Path(__file__).resolve().parent
r=[r for r in json.loads(gzip.decompress((root/'results.json.gz').read_bytes()))['results'] if r['fixture']=='reduced']
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640"><rect width="1600" height="640" fill="#fafafa"/>']
def text(x,y,s,size=20):svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#182332">{html.escape(s)}</text>')
text(40,40,'Q7–U2: reduced retained-copper search-budget witness',28)
text(40,72,'Same geometry and rules; 3 repeats each. Engine DRC: zero in both modes. Offline diagnostic only.',20)
for panel,index,title in [(0,0,'30,000 pop cap: 1 open'),(1,3,'240,000 pop cap: 0 opens')]:
 d=r[index];ox=40+panel*790;oy=140;scale=14
 def p(v):return (ox+(v['x']/10000-78)*scale,oy+(-v['y']/10000-98)*scale)
 svg.append(f'<rect x="{ox}" y="{oy}" width="750" height="365" fill="white" stroke="#c9d0da"/>')
 text(ox,120,title,24)
 for t in d['tracks']:
  color='#14824a' if t.get('origin')=='router' else ('#bd3838' if t['sheet']==0 else '#3f6ab5')
  pts=' '.join(f'{p(v)[0]:.2f},{p(v)[1]:.2f}' for v in t['pts'])
  dash=' stroke-dasharray="6 3"' if t['sheet']==1 else ''
  svg.append(f'<polyline points="{pts}" stroke="{color}" stroke-width="{t["width"]/10000*scale:.2f}" fill="none" stroke-linecap="round" stroke-linejoin="round"{dash}/>')
 for b in d['barrels']:
  x,y=p(b['at']);color='#14824a' if b.get('origin')=='router' else '#71568e'
  svg.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{.3*scale}" fill="{color}"/><circle cx="{x:.2f}" cy="{y:.2f}" r="{.2*scale}" fill="white"/>')
 for pad,label,w,h in [(d['pads'][0],'Q7.1',.8001,.8001),(d['pads'][1],'U2.4',1.143,.508)]:
  x,y=p(pad['at']);svg.append(f'<rect x="{x-w*scale/2}" y="{y-h*scale/2}" width="{w*scale}" height="{h*scale}" fill="#bf8124"/>');text(x-12,y+30,label,17)
 text(ox,545,'250 µm width · 200 µm clearance · 600/400 µm vias',19)
text(40,590,'Red: retained front tracks     Blue dashed: retained back tracks     Green: diagnostic route',20)
text(40,622,'The larger cap is a witness, not a proposed default or a native benchmark improvement.',18)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
