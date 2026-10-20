# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib, json, math, statistics, sys, tarfile, tempfile
CASES=['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']
def require(ok, message):
 if not ok:raise ValueError(message)
def validate(p, check_manifest=True):
 if check_manifest:
  manifest=json.loads((p/'manifest.json').read_text())
  members={str(f.relative_to(p))for f in p.rglob('*')if f.is_file()and f!=p/'manifest.json'and '__pycache__'not in f.relative_to(p).parts}
  require(isinstance(manifest,dict)and set(manifest)==members,'manifest membership mismatch')
  for name,h in manifest.items():
   require(hashlib.sha256((p/name).read_bytes()).hexdigest()==h,'checksum '+name)
 rows=json.loads((p/'timings.json').read_text())
 schedule=[(c,i,v)for c in CASES for i in range(3)for v in (['control','candidate']if i%2==0 else ['candidate','control'])]
 require([(r['case'],r['repeat'],r['variant'])for r in rows]==schedule,'schedule')
 with tempfile.TemporaryDirectory()as temp:
  w=Path(temp)
  with tarfile.open(p/'attempts.tar.xz')as t:t.extractall(w,filter='data')
  summary=[]
  for c in CASES:
   expected=json.loads((p/'reference'/c/'router-summary.json').read_text())
   expected['result']['report'].pop('wallClockMs')
   for row in [r for r in rows if r['case']==c]:
    d=w/f"{c}-{row['repeat']}-{row['variant']}"
    seconds=json.loads((d/'timing.json').read_text())['seconds']
    require(isinstance(seconds,(int,float))and math.isfinite(seconds)and seconds>0,'invalid seconds')
    require(row['seconds']==seconds,'timing mismatch')
    require((d/'board.ses').read_bytes()==(p/'reference'/c/'board.ses').read_bytes(),'session '+str(d))
    actual=json.loads((d/'router-summary.json').read_text());actual['result']['report'].pop('wallClockMs')
    require(actual==expected,'settings/results/report '+str(d))
   s={'case':c}
   for v in ['control','candidate']:
    ts=[r['seconds']for r in rows if r['case']==c and r['variant']==v]
    s[v]={'median':statistics.median(ts),'p95':max(ts),'total':sum(ts)}
   s['engineResidual']=expected['result']['report']['incompleteAfter']
   s['representedViolationsAdded']=expected['result']['report']['violationsAdded']
   summary.append(s)
 require(summary==json.loads((p/'summary.json').read_text()),'summary mismatch')
 return summary
if __name__=='__main__':
 p=Path(sys.argv[1]).resolve()if len(sys.argv)>1 else Path(__file__).resolve().parent
 validate(p);print('PASS: checksums, complete schedule, 18 sessions/full reports/timings, recomputed summary')
