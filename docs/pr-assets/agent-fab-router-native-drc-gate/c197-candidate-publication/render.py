import argparse,json,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);p.add_argument('out',type=pathlib.Path);x=p.parse_args();x.out.mkdir(parents=True,exist_ok=True)
s=json.loads((x.root/'native/summary.json').read_text());repairs=json.loads((x.root/'repairs/results.json').read_text())
assert s['accepted']==s['published']==69 and len(repairs)==6
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="740" viewBox="0 0 1400 740"><rect width="1400" height="740" fill="#f4f7fb"/>']
def text(x,y,t,size=24,color='#142a43'):parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{color}">{t}</text>')
def rect(x,y,w,h,c):parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{c}"/>')
text(55,65,'Publish the board bytes that native validation checked',36)
text(55,105,'26 retained cases × 3 seeds · same source bytes · native checker 10.0.6',23)
text(55,165,'Full suite: decisions unchanged',27)
for y,label,good in [(215,'Read-only gate: eligible',s['accepted']),(300,'Bundle publisher: published',s['published'])]:
 text(55,y+30,label,22);rect(410,y,good*10,48,'#187f77');rect(410+good*10,y,(78-good)*10,48,'#c65350');text(425,y+32,str(good),24,'white');text(1110,y+32,str(78-good),24,'white')
text(410,392,'69 eligible snapshots retained; 9 thermal-error candidates blocked',21)
text(55,465,'Existing offline repair witnesses: geometry unchanged in this cycle',27)
text(70,520,'Unsafe complete route: 2 thermal errors, 0 opens → blocked 3/3',24,'#b14340')
text(70,567,'Previously repaired route: 0 errors, 0 opens → published 3/3',24,'#12675f')
text(55,640,'Exact board + project/custom rules + reports + SHA-256 digests in one artifact',23)
text(55,688,'No routing rerun, benchmark score gain, automatic repair, or live-editor transaction',21,'#56677a')
parts.append('</svg>');svg=x.out/'comparison.svg';svg.write_text('\n'.join(parts));subprocess.run(['rsvg-convert','-w','1600',str(svg),'-o',str(x.out/'comparison.png')],check=True)
