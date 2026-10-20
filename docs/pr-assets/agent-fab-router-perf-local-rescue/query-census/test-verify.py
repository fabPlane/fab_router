from pathlib import Path
import tempfile,shutil,gzip,json
from verify import verify
p=Path(__file__).resolve().parent
verify(p)
with tempfile.TemporaryDirectory(prefix='query-census-controls-') as t:
 root=Path(t)/'query-census';shutil.copytree(p,root)
 (root.parent/'default-slow-profile').symlink_to(p.parent/'default-slow-profile',target_is_directory=True)
 case=next((root/'runs').iterdir())
 for name,mutate in [
  ('board.ses.gz',lambda b:b+b'corrupt'),
  ('router-summary.json.gz',lambda b:json.dumps({**json.loads(b),'settings':{}}).encode()),
 ]:
  f=case/name;old=f.read_bytes();f.write_bytes(gzip.compress(mutate(gzip.decompress(old))))
  try:verify(root)
  except AssertionError:pass
  else:raise AssertionError('accepted corruption '+name)
  f.write_bytes(old)
 f=root/'instrumented-grid.ts.gz';old=f.read_bytes();f.write_bytes(gzip.compress(gzip.decompress(old)+b'corrupt'))
 try:verify(root)
 except AssertionError:pass
 else:raise AssertionError('accepted source corruption')
 f.write_bytes(old)
 f=case/'census.log';old=f.read_text();f.write_text('')
 try:verify(root)
 except AssertionError:pass
 else:raise AssertionError('accepted missing census')
 f.write_text(old)
print('PASS baseline and four session/report/source/missing-counter corruption controls')
