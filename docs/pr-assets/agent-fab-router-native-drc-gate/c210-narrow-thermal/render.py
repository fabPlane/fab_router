import json,pathlib,html
r=pathlib.Path(__file__).resolve().parent
rows=json.loads((r/'summary.json').read_text())+json.loads((r/'narrow-summary.json').read_text())
rows=sorted((x for x in rows if x['side']==1),key=lambda x:x['radius'])
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1140" viewBox="0 0 1600 1140"><rect width="1600" height="1140" fill="#f6f8fc"/>']
def text(x,y,t,size=24,color='#16243d'):
 s.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{color}">{html.escape(str(t))}</text>')
text(60,70,'Aquarius axial thermal: local geometry is only one acceptance check',34)
text(60,115,'Same reduced board, native 10.0.6; each offset checked once. No router rerun.',24)
headers=[(60,'Offset (mm)'),(300,'New native errors'),(850,'Net ownership'),(1150,'Opens / 110'),(1390,'Accept')]
for x,t in headers:text(x,175,t,23)
for i,row in enumerate(rows):
 y=205+i*58;s.append(f'<rect x="45" y="{y}" width="1510" height="52" rx="7" fill="{ "#e0f2ef" if not row["errors"] and all(row["nativeCopperChecks"]) else "#e8edf5"}"/>')
 for x,t in [(60,f"{row['radius']:.3f}"),(300,', '.join(row['errors']) or 'none'),(850,'preserved' if all(row['nativeCopperChecks']) else 'CHANGED'),(1150,row['opens']),(1390,'reject')]:text(x,y+35,t,23)
text(60,965,'0.060 mm repeated 3 times: 0 errors, ownership preserved, 111 opens, rejected.',25)
text(60,1010,'Nine-item net control: 1 to 0 thermal errors, 109 opens, preserved ownership, accepted 3/3.',24)
text(60,1060,'Manual local control only. Full Aquarius remains unresolved; no router rerun.',23)
s.append('</svg>');(r/'comparison.svg').write_text(''.join(s))
