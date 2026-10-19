"""Draw native opens for all frozen cases; failed attempts remain included."""
from pathlib import Path
import json,sys,html
source,out=map(Path,sys.argv[1:]);d=json.loads(source.read_text());rows=d['attempts'];assert len(rows)==78
cases=sorted({r['case']for r in rows});width=1500;height=120+len(cases)*36
maximum=max(sum(r[m]['opens']for r in rows if r['case']==case)for case in cases for m in ['before','after']);scale=850/max(1,maximum)
s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">','<rect width="100%" height="100%" fill="white"/>','<g font-family="sans-serif" fill="#172c40">','<text x="30" y="30" font-size="23">Rejected candidate · native opens, all 26 cases · three repeats per mode</text>','<text x="30" y="58" font-size="17">Blue: global proposal offset   Green: obstacle kind/sheet offset · recovery enabled in both</text>']
for i,case in enumerate(cases):
 y=93+i*36;v=[sum(r[m]['opens']for r in rows if r['case']==case)for m in ['before','after']]
 s.append(f'<text x="30" y="{y+13}" font-size="13">{html.escape(case)}</text>')
 for j,(n,color)in enumerate(zip(v,['#3477b3','#208660'])):
  s.append(f'<rect x="470" y="{y+j*14}" width="{n*scale}" height="12" fill="{color}"/><text x="{480+n*scale}" y="{y+j*14+11}" font-size="12">{n}</text>')
s+=['</g></svg>'];out.write_text('\n'.join(s)+'\n')
