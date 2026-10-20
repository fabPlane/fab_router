# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import gzip,json,statistics,subprocess,sys,tarfile
p=Path(__file__).resolve().parent;w=Path(sys.argv[1]).resolve()
rows=json.loads((w/'timings.json').read_text());summary=[]
for c in dict.fromkeys(r['case']for r in rows):
 s={'case':c}
 for v in ['control','candidate']:
  ts=[r['seconds']for r in rows if r['case']==c and r['variant']==v]
  if len(ts)!=3:raise ValueError('repeat count')
  s[v]={'median':statistics.median(ts),'p95':max(ts),'total':sum(ts)}
 report=json.loads((p/'reference'/c/'router-summary.json').read_text())['result']['report']
 s['engineResidual']=report['incompleteAfter'];s['representedViolationsAdded']=report['violationsAdded'];summary.append(s)
(p/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(p/'timings.json').write_bytes((w/'timings.json').read_bytes())
with tarfile.open(p/'attempts.tar.xz','w:xz')as t:
 for r in rows:
  n=f"{r['case']}-{r['repeat']}-{r['variant']}";t.add(w/n,arcname=n);t.add(w/(n+'.log'),arcname=n+'.log')
print(json.dumps(summary,indent=2))
