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
 census=json.loads(read(out/'census.json'));t=census['totals'];kinds=census['rows']
 assert set(census)=={'rows','totals'} and set(t)=={'calls','unowned'}
 assert all(type(n)==int and n>=0 for n in t.values())
 for key,r in kinds.items():
  assert key.split(':')[0] in ['pad','barrel','track','pour','fence','rim']
  assert key.split(':')[1] in ['disk','box','capsule','hull','rounded']
  assert set(r)=={'registered','calls','repeated','changed'}
  assert all(type(n)==int and n>=0 for n in r.values())
  assert r['registered']>0 and r['repeated']<=r['calls'] and r['calls']-r['repeated']<=r['registered']
  assert r['changed']<=r['calls']
 assert t['calls']==t['unowned']+sum(r['calls'] for r in kinds.values())
 previous=json.loads(read(p.parent/'core-census'/case/'census.json'))
 assert t['calls']==sum(r['calls'] for r in previous.values()),'call-count parity'
 rows.append({'case':case,'totals':t,'rows':kinds})
assert rows==json.loads((p/'summary.json').read_text()),'summary mismatch'
print(json.dumps(rows,indent=2))
