"""Failure controls on a temporary package; originals are never modified."""
from pathlib import Path
import tempfile,shutil,json,tarfile,subprocess,sys
from verify import verify
p=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='profile-verifier-',dir='/tmp') as t:
 root=Path(t)/'package';shutil.copytree(p,root)
 verify(root)
 case=next(iter(json.loads((root/'audit.json').read_text())['inputs']))
 for name,mutate in [
  ('session',lambda d:d/'runs'/(case+'-profiled')/'board.ses'),
  ('report',lambda d:d/'runs'/(case+'-unprofiled')/'router-summary.json'),
  ('input',lambda d:d/case/'board.dsn')]:
  f=mutate(root);original=f.read_bytes()
  if name=='report':
   value=json.loads(original);value['result']['report']['incompleteAfter']+=1;f.write_text(json.dumps(value))
  else:f.write_bytes(original+b'\nCORRUPTED\n')
  try:verify(root)
  except AssertionError:print('rejected',name)
  else:raise AssertionError('accepted corruption: '+name)
  f.write_bytes(original)
 source=Path(t)/'source';source.mkdir()
 with tarfile.open(root/'source.tar.gz') as tar:tar.extractall(source,filter='data')
 f=source/'src/api.ts';f.write_bytes(f.read_bytes()+b'\n// corruption control\n')
 out=Path(t)/'must-not-exist'
 rejected=subprocess.run([sys.executable,str(root/'reproduce.py'),str(source),str(out)],capture_output=True,text=True)
 assert rejected.returncode!=0 and 'source mismatch' in rejected.stderr
 assert not out.exists(),'source guard ran after output creation'
 print('rejected source before launching routing')
print('baseline and four failure controls pass')
