"""Check every retained attempt, exact candidate reconstruction and source/input identity."""
from pathlib import Path
import gzip,json,hashlib,statistics,sys

def verify(p):
 ref=p.parent/'default-slow-profile'
 def read(f):return gzip.decompress(f.read_bytes()) if f.suffix=='.gz' else f.read_bytes()
 manifest=json.loads((p/'manifest.json').read_text())
 for f,h in manifest.items():assert hashlib.sha256((p/f).read_bytes()).hexdigest()==h,(f,'hash')
 rows=json.loads((p/'timings.json').read_text());assert len(rows)==18
 base=json.loads((ref/'audit.json').read_text())
 for case,meta in base['inputs'].items():
  for f,h in meta['hashes'].items():assert hashlib.sha256((ref/case/f).read_bytes()).hexdigest()==h,(case,f,'input')
 audit=json.loads((p/'source-audit.json').read_text())
 assert audit['control']==base['source_hashes']
 assert set(audit['candidate'])==set(audit['control'])
 assert [f for f in audit['control'] if audit['candidate'][f]!=audit['control'][f]]==['src/geom/predicates.ts']
 assert hashlib.sha256(read(p/'candidate-predicates.ts.gz')).hexdigest()==audit['candidate']['src/geom/predicates.ts']
 summary={}
 seen=set()
 for r in rows:
  key=(r['case'],r['repeat'],r['variant']);assert key not in seen;seen.add(key)
  assert r['case'] in base['inputs'] and r['repeat'] in range(3) and r['variant'] in ['control','candidate']
  d=p/'runs'/f"{r['case']}-{r['repeat']}-{r['variant']}"
  actual=json.loads(read(d/'router-summary.json.gz'));expected=json.loads((ref/r['case']/'router-summary.json').read_text())
  for report in [actual,expected]:report['result']['report'].pop('wallClockMs')
  assert actual==expected,(key,'full report')
  assert read(d/'board.ses.gz')==(ref/r['case']/'board.ses').read_bytes(),(key,'session')
  assert json.loads((d/'timing.json').read_text())['seconds']==r['seconds']>0
 for case in base['inputs']:
  summary[case]={}
  for variant in ['control','candidate']:
   times=[r['seconds'] for r in rows if r['case']==case and r['variant']==variant]
   assert len(times)==3
   summary[case][variant]={'median':statistics.median(times),'p95_max3':max(times),'total':sum(times)}
 assert summary==json.loads((p/'summary.json').read_text()),'summary'
 return summary
if __name__=='__main__':print(json.dumps(verify(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent),indent=2))
