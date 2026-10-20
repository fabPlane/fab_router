import pathlib,json,html
r=pathlib.Path(__file__).resolve().parent
pairs=json.loads((r/'paired-summary.json').read_text());assert len(pairs)==6
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#f5f7fb"/>']
def text(x,y,t,size=25,color='#192c45'):
 s.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{color}">{html.escape(str(t))}</text>')
text(65,80,'Width-scaled axial proposals restore the reduced thermal control',36)
text(65,130,'Same complete board and nine-item signal backbone; three fresh native repeats per row.',25)
headers=[(65,'Control'),(650,'New thermals'),(930,'Opens'),(1130,'Ownership'),(1390,'Accept')]
for x,t in headers:text(x,215,t)
for i,(label,title)in enumerate([('before','Original signal backbone'),('after','Generated 0.06096 mm ramp')]):
 rows=[p for p in pairs if p['label']==label];assert len(rows)==3
 y=255+i*110;s.append(f'<rect x="45" y="{y}" width="1510" height="90" rx="12" fill="{ "#e4eaf3"if label=="before"else "#daf1e7"}"/>')
 for x,t in [(65,title),(650,'1 / repeat'if label=='before'else '0 / repeat'),(930,'109'),(1130,'preserved'),(1390,'0/3'if label=='before'else '3/3')]:text(x,y+55,t,27)
text(65,545,'No lost source or routed terminal pairs. Other eight generated items unchanged.',27)
text(65,595,'Independent native save: exact copper geometry and net ownership preserved.',25)
text(65,665,'Search extension follows the full prior prefix; stage cap remains 304 proposals.',25)
text(65,730,'Reduced-control result only. Full Aquarius remains blocked by lost source connections.',25)
text(65,790,'Native checks are acceptance evidence; this is not a complete-board routing score.',24)
s.append('</svg>');(r/'comparison.svg').write_text(''.join(s))
