"""Render measured four-pad copper as SVG and PNG (requires rsvg-convert)."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('results',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
d=json.loads(a.results.read_text());svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="560" viewBox="0 0 1500 560"><rect width="1500" height="560" fill="#f6f7fa"/><g font-family="sans-serif" fill="#252a36"><text x="45" y="42" font-size="26">Keep the clear search trail when pulling loses a 45° route</text>']
for offset,key,title in [(45,'before','Before: 1 open'),(790,'after','After: connected, full width')]:
    def point(p): return (offset+460+p['x']/10000*140,260-p['y']/10000*140)
    def line(pts,color,width,dash=''):
        svg.append(f'<polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x,y in map(point,pts))}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {dash}/>')
    svg.append(f'<text x="{offset}" y="100" font-size="23">{title}</text>')
    g=d['geometry'][key]
    for pad in g['pads']:
        x,y=point(pad['at']);color='#dfb959' if pad['net']==0 else '#b4b5bd'
        svg.append(f'<rect x="{x-126}" y="{y-24.5}" width="252" height="49" fill="{color}" stroke="#474b57"/>')
        svg.append(f'<text x="{x}" y="{y+7}" text-anchor="middle" font-size="19">{pad["pinName"]}</text>')
    if key=='before':
        line([{'x':0,'y':0},{'x':-25100,'y':-4000}],'#216caa',3,'stroke-dasharray="4 5"')
        for pts in [[{'x':0,'y':0},{'x':-4000,'y':-4000},{'x':-25100,'y':-4000}],[{'x':0,'y':0},{'x':-21100,'y':0},{'x':-25100,'y':-4000}]]:line(pts,'#b93b44',3,'stroke-dasharray="9 6"')
        text='Blue: clear straight shortcut. Red: blocked 45° shapings.'
    else:
        for t in g['tracks']:line(t['pts'],'#216caa',t['width']/10000*140)
        text='Blue: measured 0.25 mm track; zero engine DRC violations.'
    svg.append(f'<text x="{offset}" y="455" font-size="17">{text}</text>')
svg.append('<text x="45" y="515" font-size="18">Gold: signal pads. Grey: other-net pads. Geometry uses 140 px/mm; no vias or necking.</text></g></svg>')
a.out.mkdir(parents=True,exist_ok=True);f=a.out/'geometry.svg';f.write_text(''.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(f),'-o',str(a.out/'geometry.png')],check=True)
