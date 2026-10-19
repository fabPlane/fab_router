"""Rebuild archived stress comparisons and validate all stored payload hashes."""
from pathlib import Path
import base64,copy,gzip,hashlib,io,json,subprocess,sys,tarfile,tempfile
here=Path(__file__).resolve().parent;root=here.parents[3]
load=lambda n:json.loads(gzip.decompress((here/n).read_bytes()))
def dense_check(d):
 with tempfile.TemporaryDirectory(prefix='quilt-stress-',dir='/tmp') as tmp:
  work=Path(tmp);run=work/'dense';run.mkdir()
  assert len(d['rows'])==2
  (run/'results.json').write_text(json.dumps(d['rows']));(run/'controls.json').write_text(json.dumps(d['controls']))
  for r in d['rows']:
   folder=run/'runs'/r['record']['attempt']/'fab-router'
   for name,record in d['files'][r['record']['attempt']].items():
    raw=base64.b64decode(record['base64']);assert hashlib.sha256(raw).hexdigest()==record['sha256']
    p=folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
   assert json.loads((folder/'check.json').read_text())==r['check']
   assert json.loads((folder/'record.json').read_text())==r['record']
  for mode,ref in [('original','d62ccee9'),('candidate','790256b1')]:
   source=work/mode;source.mkdir()
   raw=subprocess.check_output(['git','archive',ref,'src'],cwd=root)
   with tarfile.open(fileobj=io.BytesIO(raw)) as archive:archive.extractall(source,filter='data')
  result=work/'comparison.json'
  r=subprocess.run([sys.executable,str(here/'compare-dense.py'),str(run),str(work/'original'),str(work/'candidate'),str(result)],capture_output=True,text=True)
  assert r.returncode==0,r.stderr
  assert json.loads(result.read_text())==json.loads((here/'dense-comparison.json').read_text())
def ladder_check(rows):
 assert [r['case']for r in rows]==['l2','l3-cycle18']
 for row in rows:
  assert hashlib.sha256(row['inputDsn'].encode()).hexdigest()==row['inputSha256']
  a,b=[row['pair'][m]for m in ('original','candidate')]
  assert a['ses']==b['ses'];a,b=a['result'],b['result']
  assert a['settings']==b['settings'] and a['stats']==b['stats']
  assert {k:v for k,v in a['report'].items()if k!='wallClockMs'}=={k:v for k,v in b['report'].items()if k!='wallClockMs'}
  assert not a['report']['timedOut'] and not b['report']['timedOut']
  assert a['report']['violationsAdded']==b['report']['violationsAdded']==0
for name,digest in json.loads((here/'manifest.json').read_text()).items():assert hashlib.sha256((here/name).read_bytes()).hexdigest()==digest,name
dense=load('dense-raw.json.gz');dense_check(dense);ladder=load('ladder-records.json.gz');ladder_check(ladder)
with tempfile.TemporaryDirectory(prefix='quilt-slow-',dir='/tmp') as tmp:
 work=Path(tmp);current=work/'slow.json';current.write_text(json.dumps(load('slow.json.gz')));out=work/'comparison.json'
 result=subprocess.run([sys.executable,str(here/'compare-slow.py'),str(here.parent/'point-components/slow-after.json.gz'),str(current),str(out)],capture_output=True,text=True)
 assert result.returncode==0,result.stderr
 assert json.loads(out.read_text())==json.loads((here/'slow-comparison.json').read_text())
for name,mutate in [('missing-dense',lambda d:d['rows'].pop()),('dense-check',lambda d:d['rows'][1]['check'].update(new_errors=-1))]:
 bad=copy.deepcopy(dense);mutate(bad)
 try:dense_check(bad)
 except (AssertionError,KeyError):print('PASS rejected',name)
 else:raise AssertionError(name)
bad=copy.deepcopy(ladder);bad[1]['pair']['candidate']['ses']+='bad'
try:ladder_check(bad)
except AssertionError:print('PASS rejected ladder-session')
else:raise AssertionError('ladder-session')
print('PASS archived dense native, ladder engine and complete enabled slow comparisons')
