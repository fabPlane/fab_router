"""Rebuild the paired comparison from lossless archived native records."""
from pathlib import Path
import base64,copy,gzip,hashlib,json,subprocess,sys,tempfile,io,tarfile
here=Path(__file__).resolve().parent

def load(n):return json.loads(gzip.decompress((here/n).read_bytes()))
def verify(archive,corrupt=False):
 with tempfile.TemporaryDirectory(prefix='quilt-front-native-',dir='/tmp') as tmp:
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
   assert {k:v for k,v in pair[0]['report'].items()if k!='wallClockMs'}=={k:v for k,v in pair[1]['report'].items()if k!='wallClockMs'}
  output=root/'comparison.json'
  r=subprocess.run([sys.executable,here/'compare.py',root/'original',root/'candidate',output],capture_output=True,text=True)
  assert r.returncode==0,r.stderr
  derived=json.loads(output.read_text());assert not derived['regressions'] and derived['same_sessions']==78
  assert derived==json.loads((here/'comparison.json').read_text()),'Derived comparison drift'
for name,digest in json.loads((here/'manifest.json').read_text()).items():
 assert hashlib.sha256((here/name).read_bytes()).hexdigest()==digest,name
audit=load('full-source-audit.json.gz')
assert set(audit['candidate'])-set(audit['original'])=={'test/onboard-invariance.test.ts'}
assert [k for k in audit['original'] if audit['original'][k]!=audit['candidate'][k]]==['src/geom/onboard.ts']
assert json.loads((here/'checks-exit.json').read_text())['returncode']==0
for mode in ('original','candidate'):
 assert json.loads((here/(mode+'-supervisor.json')).read_text())['returncode']==0
 assert hashlib.sha256(gzip.decompress((here/(mode+'-onboard.ts.gz')).read_bytes())).hexdigest()==audit[mode]['src/geom/onboard.ts']
source=json.loads((here/'source.json').read_text())
for mode,ref in [('original',source['base']),('candidate',source.get('candidateProduction')or source['base'])]:
 raw=subprocess.check_output(['git','archive',ref,'src','spec','test','tools','package.json','tsconfig.json'],cwd=here.parents[3])
 with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
  actual={m.name:hashlib.sha256(archive.extractfile(m).read()).hexdigest()for m in archive.getmembers()if m.isfile()}
 if mode=='candidate'and not source.get('candidateProduction'):
  for name in ['src/geom/onboard.ts','test/onboard-invariance.test.ts']:
   actual[name]=hashlib.sha256(subprocess.check_output(['git','show',source['ring']+':'+name],cwd=here.parents[3])).hexdigest()
 assert actual=={k:v for k,v in audit[mode].items()if not k.startswith('entry/')},mode
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

with tempfile.TemporaryDirectory(prefix='ring-derived-',dir='/tmp')as tmp:
 out=Path(tmp)
 subprocess.run([sys.executable,here/'report.py',here/'comparison.json',out],check=True,capture_output=True)
 subprocess.run([sys.executable,here/'aggregate.py',out],check=True,capture_output=True)
 for name in ['summary.json','table.md','timings.svg','aggregate-table.md']:assert (out/name).read_bytes()==(here/name).read_bytes(),name
print('PASS derived summary/per-case table/aggregate/chart byte replay')

import statistics
from datetime import datetime
probe=[]
for pair in range(3):
 for mode in ['original','candidate']:
  rows=[json.loads(x)for x in gzip.decompress((here/f'probe-{pair}-{mode}.jsonl.gz').read_bytes()).decode().splitlines()]
  assert len(rows)==2
  for i,r in enumerate(rows):r.update(pair=pair,mode=mode,iteration=i);probe.append(r)
for key in ['ses_sha256','statsAfter','settings','input_sha256']:
 assert len({json.dumps(r[key],sort_keys=True)for r in probe})==1,key
assert len({json.dumps({k:v for k,v in r['report'].items()if k!='wallClockMs'},sort_keys=True)for r in probe})==1
for pair in range(3):
 order=['original','candidate']if pair%2==0 else['candidate','original']
 a,b=[sorted([r for r in probe if r['pair']==pair and r['mode']==mode],key=lambda r:r['iteration'])for mode in order]
 assert a[-1]['finished_utc']<=b[0]['started_utc']
summary={m:{str(i):{'seconds':[r['seconds']for r in probe if r['mode']==m and r['iteration']==i]}for i in [0,1]}for m in ['original','candidate']}
for values in summary.values():
 for r in values.values():r.update(median=statistics.median(r['seconds']),p95=max(r['seconds']))
assert {'timing':summary,'all12sessionsReportsStatsIdentical':True}==json.loads((here/'probe-summary.json').read_text())
print('PASS all12 unprofiled replay records, actual counterbalanced chronology, report/stat/session parity and derived timings')

provenance=load('case-provenance.json.gz')
assert set(provenance)=={x if isinstance(x,str)else x['id']for x in load('original-controls.json.gz')['cases']}
for files in provenance.values():
 for rec in files.values():assert hashlib.sha256(base64.b64decode(rec['base64'])).hexdigest()==rec['sha256']
print('PASS lossless26-case licensing/provenance hashes')


fixtures=json.loads((here/'test-fixture-audit.json').read_text())
raw=subprocess.check_output(['git','archive',fixtures['base'],'docs'],cwd=here.parents[3])
with tarfile.open(fileobj=io.BytesIO(raw))as archive:
 actual={m.name:hashlib.sha256(archive.extractfile(m).read()).hexdigest()for m in archive.getmembers()if m.isfile()}
assert fixtures['docs']==actual
print('PASS unchanged documentation fixtures required by the full unit gate')

for mode in ['original','candidate']:
 result=json.loads(gzip.decompress((here/f'profile-{mode}.jsonl.gz').read_bytes()))
 reference=probe[0]
 for key in ['ses_sha256','statsAfter','statsBefore','settings','input_sha256']:assert result[key]==reference[key],key
 assert {k:v for k,v in result['report'].items()if k!='wallClockMs'}=={k:v for k,v in reference['report'].items()if k!='wallClockMs'}
print('PASS separately profiled output/settings/statistics/report parity; times excluded')
