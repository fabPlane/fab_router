from pathlib import Path
import gzip,json,hashlib
p=Path(__file__).resolve().parent
for name,digest in json.loads((p/'manifest.json').read_text()).items():
 assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest,name
rows=[]
for f in sorted(p.glob('[0-3]-*.jsonl.gz')):rows.extend(json.loads(line)for line in gzip.decompress(f.read_bytes()).decode().splitlines())
def valid(rows):
 assert len(rows)==16
 for field in ['ses_sha256','input_sha256','statsAfter','settings']:
  assert len({json.dumps(r[field],sort_keys=True)for r in rows})==1,field
 assert len({json.dumps({k:v for k,v in r['report'].items()if k!='wallClockMs'},sort_keys=True)for r in rows})==1
 assert all(not r['report']['timedOut']and not r['report']['aborted']for r in rows)
valid(rows)
for field in ['ses_sha256','statsAfter']:
 broken=json.loads(json.dumps(rows));broken[0][field]='corruption'
 try:valid(broken)
 except AssertionError:pass
 else:raise AssertionError('missed corruption '+field)
print('Manifest, sixteen invariant replays, two corruption controls PASS')
