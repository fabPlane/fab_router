"""Rebuild archived stress comparisons and validate all stored payload hashes."""
from pathlib import Path
import base64,copy,gzip,hashlib,io,json,subprocess,sys,tarfile,tempfile
here=Path(__file__).resolve().parent;root=here.parents[3]
load=lambda n:json.loads(gzip.decompress((here/n).read_bytes()))
def dense_check(d):
 with tempfile.TemporaryDirectory(prefix='quilt-stress-',dir='/tmp') as tmp:
  work=Path(tmp);run=work/'dense';run.mkdir()
  assert len(d['rows'])==6
  for name,rec in d['fixtureFiles'].items():
   assert hashlib.sha256(base64.b64decode(rec['base64'])).hexdigest()==rec['sha256']==d['controls']['fixture_sha256'][name]
  (run/'results.json').write_text(json.dumps(d['rows']));(run/'controls.json').write_text(json.dumps(d['controls']))
  for r in d['rows']:
   folder=run/'runs'/r['record']['attempt']/'fab-router'
   for name,record in d['files'][r['record']['attempt']].items():
    raw=base64.b64decode(record['base64']);assert hashlib.sha256(raw).hexdigest()==record['sha256']
    p=folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
   assert json.loads((folder/'check.json').read_text())==r['check']
   assert json.loads((folder/'record.json').read_text())==r['record']
  source_refs=json.loads((here/'source.json').read_text())
  for mode,ref in [('original',source_refs['base']),('candidate',source_refs.get('candidateProduction')or source_refs['base'])]:
   source=work/mode;source.mkdir()
   raw=subprocess.check_output(['git','archive',ref,'src'],cwd=root)
   with tarfile.open(fileobj=io.BytesIO(raw)) as archive:archive.extractall(source,filter='data')
  if not source_refs.get('candidateProduction'):
   (work/'candidate/src/geom/onboard.ts').write_bytes(subprocess.check_output(['git','show',source_refs['ring']+':src/geom/onboard.ts'],cwd=root))
  result=work/'comparison.json'
  r=subprocess.run([sys.executable,str(here/'compare-dense.py'),str(run),str(work/'original'),str(work/'candidate'),str(result)],capture_output=True,text=True)
  assert r.returncode==0,r.stderr
  assert json.loads(result.read_text())==json.loads((here/'dense-comparison.json').read_text())
for name,digest in json.loads((here/'manifest.json').read_text()).items():assert hashlib.sha256((here/name).read_bytes()).hexdigest()==digest,name
dense=load('dense-raw.json.gz');dense_check(dense)
for name,mutate in [('missing-dense',lambda d:d['rows'].pop()),('dense-check',lambda d:d['rows'][1]['check'].update(new_errors=-1))]:
 bad=copy.deepcopy(dense);mutate(bad)
 try:dense_check(bad)
 except (AssertionError,KeyError):print('PASS rejected',name)
 else:raise AssertionError(name)
print('PASS archived three-pair dense native comparison and two corruption controls')

ladder=load('ladder-records.json.gz')
assert len(ladder)==2
for row in ladder:
 assert hashlib.sha256(row['inputDsn'].encode()).hexdigest()==row['inputSha256']
 a,b=[row['pair'][m]for m in ['original','candidate']]
 assert a['ses']==b['ses']
 for k in ['settings','stats']:assert a['result'][k]==b['result'][k]
 reports=[r['result']['report']for r in [a,b]]
 assert {k:v for k,v in reports[0].items()if k!='wallClockMs'}=={k:v for k,v in reports[1].items()if k!='wallClockMs'}
 assert all(not r['timedOut'] and not r['aborted'] and r['violationsAdded']==0 for r in reports)
print('PASS ladder input hashes, paired settings, sessions, statistics and reports except wall')
