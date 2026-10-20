from pathlib import Path
import hashlib,json,subprocess,sys,tempfile
p=Path(__file__).resolve().parent
w=Path(sys.argv[1]) if len(sys.argv)>1 else p
if (w/'native-manifest.json').exists():
 for f,h in json.loads((w/'native-manifest.json').read_text()).items():
  assert hashlib.sha256((w/f).read_bytes()).hexdigest()==h,(f,'archive member hash')
with tempfile.TemporaryDirectory(prefix='ring-native-') as t:
 out=Path(t)/'comparison.json'
 subprocess.run([sys.executable,str(p/'compare.py'),str(w/'native-control'),str(w/'native-candidate'),str(out)],check=True,stdout=subprocess.DEVNULL)
 x=json.loads(out.read_text());assert x==json.loads((w/'comparison.json').read_text())
 assert x['same_sessions']==78 and not x['regressions']
by=[]
audit=json.loads((p/'source-audit.json').read_text())
for mode in ['control','candidate']:
 c=json.loads((w/f'native-{mode}/controls.json').read_text())
 assert c['candidate']['source_sha256']=={f:h for f,h in audit[mode].items() if f.startswith('src/')}
 rs=json.loads((w/f'native-{mode}/results.json').read_text());records={}
 for r in rs:
  d=w/f'native-{mode}'/r['evidence']/'work';v=json.loads((d/'router-summary.json').read_text());v['result']['report'].pop('wallClockMs')
  records[(r['case'],r['seed'])]=v
 by.append(records)
assert by[0]==by[1]
print('PASS 156 native attempts; frozen controls, source identity, all paired sessions/settings/reports/native findings and quality')
