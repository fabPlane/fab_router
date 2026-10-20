import argparse,json,pathlib,subprocess,html
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);p.add_argument('out',type=pathlib.Path);x=p.parse_args();x.out.mkdir(parents=True,exist_ok=True)
s=json.loads((x.root/'native/summary.json').read_text());rows=json.loads((x.root/'native/results.json').read_text());changed=[r for r in rows if r['accepted']!=r['published']]
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><rect width="1400" height="880" fill="#f4f7fb"/>']
def text(x,y,t,size=24,c='#162d43'):parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{c}">{html.escape(t)}</text>')
def line(x1,y1,x2,y2,c='#167d71'):parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="9"/>')
def node(x,y,label,c='#167d71'):
 parts.append(f'<circle cx="{x}" cy="{y}" r="23" fill="{c}"/>');text(x-13,y+9,label,25,'white')
text(50,62,'Preserve connected pads, even when the open count improves',34)
text(50,110,'Native zone-split regression: same pads, rules and source copper; only tracks added',22)
text(110,167,'Before: {A, B, C} + {D}',27);text(765,167,'After: {A, C} + {B, D}',27)
for ox,edges in [(0,[(0,1),(0,2)]),(660,[(0,2),(1,3)])]:
 coords=[(160+ox,235),(400+ox,235),(160+ox,355),(400+ox,355)]
 for a,b in edges:line(*coords[a],*coords[b])
 for coord,label in zip(coords,'ABCD'):node(*coord,label)
text(100,420,'1 open; 0 new native errors',24);text(760,420,'1 open; 0 new native errors',24)
text(50,483,'Old gate: ACCEPTED 3/3',27,'#b54440');text(740,483,'New gate: BLOCKED 3/3 (2 lost pairs)',27,'#146d63')
text(50,552,'26 retained benchmark cases × 3 seeds · paired fresh native checks',26)
text(65,600,f'Eligible snapshots: {s["accepted"]} before → {s["published"]} after; {len(changed)} newly blocked',25)
text(65,646,f'Connected-pair losses found: {s["lost_terminal_pairs"]}; thermal errors still {s["new_errors"]}; opens still {s["opens"]}',24)
text(65,693,'Real case: U2 pad 8 loses 17 ground-pad connections as opens fall 14 → 1',24)
text(50,761,'Existing clean thermal witness still publishes 3/3; unsafe witness still blocked 3/3',23)
text(50,817,'Optional offline boundary only · no routing rerun, score gain, or live-editor transaction',21,'#596b7d')
parts.append('</svg>');svg=x.out/'comparison.svg';svg.write_text('\n'.join(parts));subprocess.run(['rsvg-convert','-w','1600',str(svg),'-o',str(x.out/'comparison.png')],check=True)
