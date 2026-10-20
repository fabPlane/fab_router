from pathlib import Path
import tempfile, shutil, json, hashlib, subprocess, tarfile
p=Path(__file__).resolve().parent
subprocess.run(['python3',str(p/'verify.py')],check=True)
for mode in ['timing','schedule','summary','session']:
 with tempfile.TemporaryDirectory(prefix='rim-hybrid-verify-') as temp:
  root=Path(temp); q=root/'rim-hybrid'; shutil.copytree(p,q)
  (root/'default-slow-profile').symlink_to(p.parent/'default-slow-profile')
  if mode in ['timing','schedule']:
   f=q/'timings.json'; rows=json.loads(f.read_text())
   if mode=='timing': rows[0]['seconds']+=1
   else: rows.pop()
   f.write_text(json.dumps(rows))
  if mode=='summary':
   f=q/'summary.json'; rows=json.loads(f.read_text()); rows[0]['candidate']['median']+=1; f.write_text(json.dumps(rows))
  if mode=='session':
   d=root/'runs';d.mkdir()
   with tarfile.open(q/'attempts.tar.xz') as t:t.extractall(d,filter='data')
   next(d.glob('*/board.ses')).write_text('altered session')
   with tarfile.open(q/'attempts.tar.xz','w:xz') as t:
    for f in d.iterdir():t.add(f,arcname=f.name)
  (q/'manifest.json').write_text(json.dumps({str(f.relative_to(q)):hashlib.sha256(f.read_bytes()).hexdigest() for f in q.rglob('*') if f.is_file() and f.name!='manifest.json'}))
  result=subprocess.run(['python3',str(q/'verify.py')],capture_output=True)
  assert result.returncode!=0,mode
  print(mode,'corruption rejected after rehash')
