"""Plot measured native track geometry with SVG and render it as a PNG."""
from pathlib import Path
import json,sys,html,subprocess
source,out=map(Path,sys.argv[1:]);d=json.loads(source.read_text());added={tuple(t)for t in d['added_segments']}
assert {t[2]for t in added}=={250000},'Caption width must match measured copper'
pts=[(t[i]/1e6,t[i+1]/1e6)for t in added for i in [3,5]]
x0,x1=min(p[0]for p in pts)-1,max(p[0]for p in pts)+1;y0,y1=min(p[1]for p in pts)-1,max(p[1]for p in pts)+1
W,H=1600,1000;panelW,panelH=710,790;scale=min(panelW/(x1-x0),panelH/(y1-y0))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">','<rect width="1600" height="1000" fill="#ffffff"/>', '<g font-family="sans-serif" fill="#182b3a">','<text x="800" y="40" text-anchor="middle" font-size="28">Native GNDA connection through an existing pour component</text>','<text x="800" y="75" text-anchor="middle" font-size="20">F.Cu · gold: added 0.25 mm copper · blue: target net · grey: other nets</text>']
for i,b in enumerate(d['boards']):
 ox=40+i*800;oy=150;tx=lambda x:ox+(x/1e6-x0)*scale;ty=lambda y:oy+(y/1e6-y0)*scale
 svg.append(f'<text x="{ox+355}" y="125" text-anchor="middle" font-size="24">{"Before"if i==0 else"After"}: {d["opens"][i]} native {"open"if d["opens"][i]==1 else"opens"}, {d["new_errors"][i]} new errors</text>')
 svg.append(f'<defs><clipPath id="panel{i}"><rect x="{ox}" y="{oy}" width="{panelW}" height="{panelH}"/></clipPath></defs><g clip-path="url(#panel{i})">')
 svg.append(f'<rect x="{ox}" y="{oy}" width="{panelW}" height="{panelH}" fill="#f8fafc"/>')
 for p in b['pads']:
  color='#bfdaf0'if p['net']==d['net']else'#e1e6ea'
  svg.append(f'<rect x="{tx(p["x0"]):.5f}" y="{ty(p["y0"]):.5f}" width="{(p["x1"]-p["x0"])/1e6*scale:.5f}" height="{(p["y1"]-p["y0"])/1e6*scale:.5f}" fill="{color}"/>')
 for t in sorted(b['segments'],key=lambda t:tuple(t)in added):
  color='#b67b00'if tuple(t)in added else'#185c9b'if t[0]==d['net']else'#a6afb6'
  svg.append(f'<path d="M {tx(t[3]):.5f},{ty(t[4]):.5f} L {tx(t[5]):.5f},{ty(t[6]):.5f}" fill="none" stroke="{color}" stroke-width="{t[2]/1e6*scale:.5f}" stroke-linecap="round"/>')
 for v in b['vias']:
  color='#185c9b'if v['net']==d['net']else'#a6afb6'
  for r,fill in [(v['diameter']/2,color),(v['drill']/2,'white')]:svg.append(f'<circle cx="{tx(v["x"]):.5f}" cy="{ty(v["y"]):.5f}" r="{r/1e6*scale:.5f}" fill="{fill}"/>')
 svg.append('</g>')
 # Native coordinates are millimetres; a physical scale bar avoids implied pixel units.
 svg.append(f'<path d="M {ox+20},960 h {scale*2:.5f}" stroke="#182b3a" stroke-width="3"/><text x="{ox+20}" y="985" font-size="18">2 mm · pad bounds shown as context</text>')
svg.append('</g></svg>');file=out.with_suffix('.svg');file.write_text('\n'.join(svg)+'\n');subprocess.run(['rsvg-convert','-w','1600',str(file),'-o',str(out)],check=True)
