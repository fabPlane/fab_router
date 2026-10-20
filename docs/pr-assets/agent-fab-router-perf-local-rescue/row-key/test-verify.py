from pathlib import Path
import tempfile,shutil,json,gzip,hashlib,importlib.util
p=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('verify',p/'verify.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def rehash(d,f):
 manifest=json.loads((d/'manifest.json').read_text());manifest[f]=hashlib.sha256((d/f).read_bytes()).hexdigest();(d/'manifest.json').write_text(json.dumps(manifest))
for mode in ['session','report','source','missing-run']:
 with tempfile.TemporaryDirectory(prefix='row-key-test-') as t:
  d=Path(t)/'row-key';shutil.copytree(p,d);(Path(t)/'default-slow-profile').symlink_to(p.parent/'default-slow-profile')
  run=next((d/'runs').iterdir())
  if mode=='session':
   f=run/'board.ses.gz';f.write_bytes(gzip.compress(gzip.decompress(f.read_bytes())+b'changed'));rehash(d,str(f.relative_to(d)))
  elif mode=='report':
   f=run/'router-summary.json.gz';r=json.loads(gzip.decompress(f.read_bytes()));r['result']['report']['incompleteAfter']+=1;f.write_bytes(gzip.compress(json.dumps(r).encode()));rehash(d,str(f.relative_to(d)))
  elif mode=='source':
   f=d/'candidate-grid.ts.gz';f.write_bytes(gzip.compress(gzip.decompress(f.read_bytes())+b'changed'));rehash(d,f.name)
  else:
   f=d/'timings.json';r=json.loads(f.read_text());r.pop();f.write_text(json.dumps(r));rehash(d,f.name)
  try:m.verify(d)
  except AssertionError:print('PASS rejected',mode)
  else:raise AssertionError('accepted '+mode)
