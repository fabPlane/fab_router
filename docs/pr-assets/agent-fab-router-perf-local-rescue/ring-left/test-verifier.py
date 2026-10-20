from pathlib import Path
import tempfile,shutil,json,hashlib,gzip,importlib.util
p=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v',p/'verify.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.verify(p)
for mode in ['session','report','source','missing-run']:
 with tempfile.TemporaryDirectory(prefix='heap-verifier-') as t:
  root=Path(t);q=root/'ring-left';shutil.copytree(p,q);(root/'default-slow-profile').symlink_to(p.parent/'default-slow-profile')
  d=next((q/'runs').iterdir())
  if mode=='session':(d/'board.ses.gz').write_bytes(gzip.compress(b'invalid'))
  if mode=='report':
   f=d/'router-summary.json.gz';r=json.loads(gzip.decompress(f.read_bytes()));r['settings']['passes']=999;f.write_bytes(gzip.compress(json.dumps(r).encode()))
  if mode=='source':
   f=q/'source-audit.json';r=json.loads(f.read_text());r['candidate']['src/geom/predicates.ts']='0'*64;f.write_text(json.dumps(r))
  if mode=='missing-run':
   f=q/'timings.json';r=json.loads(f.read_text());r.pop();f.write_text(json.dumps(r))
  (q/'manifest.json').write_text(json.dumps({str(f.relative_to(q)):hashlib.sha256(f.read_bytes()).hexdigest() for f in q.rglob('*') if f.is_file() and f.name!='manifest.json'}))
  try:m.verify(q)
  except (AssertionError,KeyError):print(mode,'REJECTED')
  else:raise AssertionError(mode)
print('original PASS; four semantic corruptions rejected after rehash')
