#!/usr/bin/python3
"""Render measured additive thermal-link outcomes."""
import html,json,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]);s=json.loads((root/'analysis.json').read_text())
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="530"><rect width="1180" height="530" fill="white"/>']
def text(x,y,value,size=21):svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(str(value))}</text>')
text(30,48,s.get('title','Additive same-net thermal links at U1.53'),29)
text(30,90,'Same board and rules; native refill and DRC; cores 20–25; three repeats')
for i,r in enumerate(s['rows']):
 a=r['attempts'];errors=[x['errors'] for x in a]
 text(30,150+i*85,f'Repeat {r["repeat"]}: {len(a)} links; {sum(not x["retains_target"] for x in a)} remove target; accepted: {r["accepted"]}')
 text(50,184+i*85,(f'Before: {r["baseline_errors"]} errors / {r["baseline_opens"]} opens; selected: {a[-1]["errors"]} errors / {a[-1]["opens"]} opens' if 'baseline_errors' in r else f'Candidate errors: {min(errors)}–{max(errors)}; design/rule rejections: {sum(x["exception"] is not None for x in a)}'),19)
text(30,440,'Eight directions × three widths; stop at the first native-accepted link.',20)
text(30,485,'Fixture-specific static repair; no production router change.',21)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
