"""Validate census attempts against immutable retained default-case references."""
from pathlib import Path
import gzip,json,sys,hashlib

def verify(p):
 ref=p.parent/'default-slow-profile'; out={}
 audit=json.loads(gzip.decompress((p/'source-audit.json.gz').read_bytes()))
 base=json.loads((ref/'audit.json').read_text())['source_hashes']
 assert set(audit)==set(base)
 assert [f for f in audit if audit[f]!=base[f]]==['src/lattice/grid.ts']
 assert hashlib.sha256(gzip.decompress((p/'instrumented-grid.ts.gz').read_bytes())).hexdigest()==audit['src/lattice/grid.ts']
 for case,meta in json.loads((ref/'audit.json').read_text())['inputs'].items():
  for f,h in meta['hashes'].items():assert hashlib.sha256((ref/case/f).read_bytes()).hexdigest()==h,(case,f,'input hash')
  d=p/'runs'/case
  actual=json.loads(gzip.decompress((d/'router-summary.json.gz').read_bytes()))
  expected=json.loads((ref/case/'router-summary.json').read_text())
  for report in [actual,expected]:report['result']['report'].pop('wallClockMs')
  assert actual==expected,(case,'report')
  assert gzip.decompress((d/'board.ses.gz').read_bytes())==(ref/case/'board.ses').read_bytes(),(case,'session')
  rows=[json.loads(line.removeprefix('QUERY_CENSUS ')) for line in (d/'census.log').read_text().splitlines() if line.startswith('QUERY_CENSUS ')]
  assert rows,(case,'missing counters')
  for r in rows:
   assert all(isinstance(v,int) and v>=0 for v in r.values())
   assert r['sweep']+r['box']==r['queries']
   assert r['sweepHits']+r['boxHits']==r['lruHits']
   assert r['consecutive']<=r['lruHits']<=r['queries']
   assert r['filteredHits']<=r['filtered']<=r['queries']
  counts={k:sum(r[k] for r in rows) for k in rows[0]}
  out[case]={'lattices':len(rows),'counts':counts,'raw_recurrence_percent':100*counts['lruHits']/counts['queries'],'engine_incomplete':actual['result']['report']['incompleteAfter'],'violations_added':actual['result']['report']['violationsAdded']}
 return out
if __name__=='__main__':print(json.dumps(verify(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent),indent=2))
