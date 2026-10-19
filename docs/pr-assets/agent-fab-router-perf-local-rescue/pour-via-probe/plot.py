"""Plot real refilled zone polygons and copper around the candidate via."""
from pathlib import Path
import json,subprocess,sys,hashlib
import pcbnew
s=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]);data=[]
for mode in ['before','after']:
 p=s/f'native-probe/{mode}-1/refilled.kicad_pcb';b=pcbnew.LoadBoard(str(p));polys=[];tracks=[];vias=[]
 for z in b.Zones():
  if z.GetNetname()!='GNDD':continue
  layer=int(z.GetLayer());poly=z.GetFilledPolysList(layer)
  for i in range(poly.OutlineCount()):
   rings=[poly.COutline(i)]+[poly.CHole(i,j)for j in range(poly.HoleCount(i))]
   polys.append({'layer':layer,'rings':[[(r.CPoint(k).x/1e6,r.CPoint(k).y/1e6)for k in range(r.PointCount())]for r in rings]})
 for t in b.GetTracks():
  if isinstance(t,pcbnew.PCB_VIA):vias.append([t.GetPosition().x/1e6,t.GetPosition().y/1e6,t.GetWidth(pcbnew.F_Cu)/1e6,t.GetDrillValue()/1e6,t.GetNetname()])
  else:tracks.append([int(t.GetLayer()),t.GetStart().x/1e6,t.GetStart().y/1e6,t.GetEnd().x/1e6,t.GetEnd().y/1e6,t.GetWidth()/1e6,t.GetNetname()])
 data.append({'mode':mode,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'polys':polys,'tracks':tracks,'vias':vias})
# The crop is centred on the measured inserted via at 151.13,92.71 mm.
x0,y0,x1,y1=146.13,87.71,156.13,97.71;scale=65
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="950">','<rect width="1600" height="950" fill="white"/>','<g font-family="sans-serif" fill="#182b3a">','<text x="800" y="40" text-anchor="middle" font-size="28">Offline pour-to-pour via experiment</text>','<text x="800" y="76" text-anchor="middle" font-size="20">Real refilled F.Cu · front isolation warnings 20 → 0 · native opens stay 15</text>']
for i,d in enumerate(data):
 ox=60+i*800;oy=170;tx=lambda x:ox+(x-x0)*scale;ty=lambda y:oy+(y-y0)*scale
 svg.extend([f'<text x="{ox+325}" y="130" text-anchor="middle" font-size="24">{d["mode"].title()} · {130+i} vias · 6 existing errors</text>',f'<defs><clipPath id="p{i}"><rect x="{ox}" y="{oy}" width="650" height="650"/></clipPath></defs><g clip-path="url(#p{i})">',f'<rect x="{ox}" y="{oy}" width="650" height="650" fill="#f3f6f9"/>'])
 for p in d['polys']:
  if p['layer']!=pcbnew.F_Cu:continue
  path=' '.join('M '+' L '.join(f'{tx(x):.4f},{ty(y):.4f}'for x,y in ring)+' Z'for ring in p['rings'])
  svg.append(f'<path d="{path}" fill="#c0dbc9" fill-rule="evenodd"/>')
 for layer,ax,ay,bx,by,w,net in d['tracks']:
  if layer!=pcbnew.F_Cu:continue
  svg.append(f'<path d="M {tx(ax):.4f},{ty(ay):.4f} L {tx(bx):.4f},{ty(by):.4f}" stroke="#9caab7" stroke-width="{w*scale:.4f}" stroke-linecap="round"/>')
 for x,y,w,h,net in d['vias']:
  color='#b67b00'if i and abs(x-151.13)<.00001 and abs(y-92.71)<.00001 else '#6c7d8d'
  svg.append(f'<circle cx="{tx(x):.4f}" cy="{ty(y):.4f}" r="{w*scale/2:.4f}" fill="{color}"/><circle cx="{tx(x):.4f}" cy="{ty(y):.4f}" r="{h*scale/2:.4f}" fill="white"/>')
 svg.append('</g>')
 svg.append(f'<path d="M {ox},855 h {2*scale}" stroke="#182b3a" stroke-width="3"/><text x="{ox}" y="885" font-size="18">2 mm · green: filled target pour · gold: new 0.762/0.381 mm via</text>')
svg.append('<text x="800" y="930" text-anchor="middle" font-size="18">Static residual diagnostic only. No production change; board remains incomplete and DRC dirty.</text></g></svg>')
out.with_suffix('.svg').write_text('\n'.join(svg)+'\n');subprocess.run(['rsvg-convert','-w','1600',str(out.with_suffix('.svg')),'-o',str(out)],check=True)
# Compact actual-geometry evidence is reproducible from the retained native boards.
(s/'geometry.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
