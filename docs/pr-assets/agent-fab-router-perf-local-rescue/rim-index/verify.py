from pathlib import Path
import json,tarfile,hashlib,tempfile,statistics,sys
p=Path(__file__).resolve().parent;ref=p.parent/'default-slow-profile'
for f,h in json.loads((p/'manifest.json').read_text()).items():assert hashlib.sha256((p/f).read_bytes()).hexdigest()==h,f
with tempfile.TemporaryDirectory()as temp:
 w=Path(temp)
 with tarfile.open(p/'attempts.tar.xz')as t:t.extractall(w,filter='data')
 rows=json.loads((p/'timings.json').read_text());assert len(rows)==18
 assert len({(r['case'],r['repeat'],r['variant'])for r in rows})==18
 for case in ['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']:
  expected=json.loads((ref/case/'router-summary.json').read_text());expected['result']['report'].pop('wallClockMs')
  for repeat in range(3):
   for v in ['control','candidate']:
    row=next(r for r in rows if (r['case'],r['repeat'],r['variant'])==(case,repeat,v));d=w/f'{case}-{repeat}-{v}'
    assert row['seconds']==json.loads((d/'timing.json').read_text())['seconds']
    assert (d/'board.ses').read_bytes()==(ref/case/'board.ses').read_bytes()
    actual=json.loads((d/'router-summary.json').read_text());actual['result']['report'].pop('wallClockMs');assert actual==expected
 summary=json.loads((p/'summary.json').read_text());assert len(summary)==3
 for r in summary:
  for v in ['control','candidate']:
   ts=[x['seconds']for x in rows if x['case']==r['case']and x['variant']==v];assert r[v]=={'median':statistics.median(ts),'p95':max(ts)}
print('PASS: manifest, all18 sessions/full reports/timings, complete 3x3x2 schedule, summary')
