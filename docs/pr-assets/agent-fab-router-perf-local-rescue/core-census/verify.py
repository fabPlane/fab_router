from pathlib import Path
import json,sys,hashlib,gzip
p=Path(__file__).parent; w=Path(sys.argv[1]); refs=p.parent/'default-slow-profile'
def read(f):
 return f.read_bytes() if f.exists() else gzip.decompress(f.with_name(f.name+'.gz').read_bytes())
rows=[]
for case in ['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']:
 out=w/case
 assert read(out/'board.ses')==(refs/case/'board.ses').read_bytes(),case
 a=json.loads(read(out/'router-summary.json'));b=json.loads((refs/case/'router-summary.json').read_text())
 del a['result']['report']['wallClockMs'];del b['result']['report']['wallClockMs']
 assert a==b,case
 census=json.loads(read(out/'census.json'))
 for kind,r in census.items():
  assert set(r)=={'calls','repeated','consecutive'}
  assert all(isinstance(n,int) and n>=0 for n in r.values())
  assert r['consecutive']<=r['repeated']<r['calls']
 rows.append({'case':case,'calls':sum(r['calls'] for r in census.values()),'repeated':sum(r['repeated'] for r in census.values()),'kinds':census})
assert rows==json.loads((p/'summary.json').read_text()),'counter summary mismatch'
print(json.dumps(rows,indent=2))
