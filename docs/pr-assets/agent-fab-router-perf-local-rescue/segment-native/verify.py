"""Rebuild the paired comparison from lossless archived native records."""
from pathlib import Path
import base64,copy,gzip,hashlib,json,subprocess,sys,tempfile
here=Path(__file__).resolve().parent

def load(n):return json.loads(gzip.decompress((here/n).read_bytes()))
def verify(archive,corrupt=False):
 with tempfile.TemporaryDirectory(prefix='segment-native-',dir='/tmp') as tmp:
  root=Path(tmp)
  for mode in ['original','candidate']:
   d=root/mode;d.mkdir()
   for name in ['controls','results','summary']:(d/(name+'.json')).write_text(json.dumps(load(mode+'-'+name+'.json.gz')))
   expected={(r['case'],r['seed']):r for r in load(mode+'-results.json.gz')}
   assert len(archive[mode])==len(expected)==78
   seen=set()
   for attempt in archive[mode]:
    key=(attempt['case'],attempt['seed']);assert key not in seen;seen.add(key)
    assert attempt['evidence']==expected[key]['evidence']
    for name,record in attempt['files'].items():
     raw=base64.b64decode(record['base64']);assert hashlib.sha256(raw).hexdigest()==record['sha256']
     p=d/attempt['evidence']/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    c=json.loads((d/attempt['evidence']/'check.json').read_text());r=expected[key]
    assert c==r['check'],'Raw checker/results drift'
    for k,ck in [('passed','pass'),('opens','opens'),('new_errors','new_errors'),('vias','vias'),('length_mm','length_mm')]:assert r[k]==c[ck],k
   assert seen==expected.keys()
  for key in {(r['case'],r['seed']) for r in archive['original']}:
   pair=[]
   for mode in ['original','candidate']:
    a=next(r for r in archive[mode] if (r['case'],r['seed'])==key)
    pair.append(json.loads(base64.b64decode(a['files']['work/router-summary.json']['base64']))['result'])
   for field in ['statsBefore','statsAfter']:assert pair[0][field]==pair[1][field],field
  output=root/'comparison.json'
  r=subprocess.run([sys.executable,here/'compare.py',root/'original',root/'candidate',output],capture_output=True,text=True)
  assert r.returncode==0,r.stderr
  derived=json.loads(output.read_text());assert not derived['regressions'] and derived['same_sessions']==78
  assert derived==json.loads((here/'comparison.json').read_text()),'Derived comparison drift'
for name,digest in json.loads((here/'manifest.json').read_text()).items():
 assert hashlib.sha256((here/name).read_bytes()).hexdigest()==digest,name
audit=load('full-source-audit.json.gz')
assert audit['original'].keys()==audit['candidate'].keys()
assert [k for k in audit['original'] if audit['original'][k]!=audit['candidate'][k]]==['src/route/clear.ts']
reference=json.loads((here.parent/'native-profile/source-hashes.json').read_text())
for name,pair in load('source-audit.json.gz').items():
 assert pair['original']==reference[name],name
 assert all(audit[mode][name]==pair[mode] for mode in ('original','candidate')),name
assert all(v['returncode']==0 for v in json.loads((here/'checks-exits.json').read_text()).values())
for mode in ('original','candidate'):
 assert json.loads((here/(mode+'-supervisor.json')).read_text())['returncode']==0
candidate_bytes=gzip.decompress((here.parent/'segment-shortcut/clear-candidate.ts.gz').read_bytes())
assert hashlib.sha256(candidate_bytes).hexdigest()==audit['candidate']['src/route/clear.ts']
archive=load('raw-attempts.json.gz');verify(archive)
for label in ['missing-repeat','session-bytes','new-error','effective-settings']:
 d=copy.deepcopy(archive)
 if label=='missing-repeat':d['candidate'].pop()
 else:
  a=d['candidate'][0]
  name={'session-bytes':'work/board.ses','new-error':'check.json','effective-settings':'work/router-summary.json'}[label]
  rec=a['files'][name];raw=base64.b64decode(rec['base64'])
  if label=='session-bytes':raw+=b'\n'
  else:
   obj=json.loads(raw)
   if label=='new-error':obj['new_error_details'].append({'type':'corruption-control'})
   else:obj['result']['report']['effectiveSettings']['localRecovery']=False
   raw=json.dumps(obj).encode()
  rec.update(base64=base64.b64encode(raw).decode(),sha256=hashlib.sha256(raw).hexdigest())
 try:verify(d,True)
 except (AssertionError,KeyError):print('PASS rejected',label)
 else:raise AssertionError('Accepted '+label)
print('PASS archived 78-pair full native comparison and four corruption controls')
