from pathlib import Path
import tempfile,shutil,json,hashlib,subprocess,tarfile
p=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory()as tmp:
 dest=Path(tmp)/'item-view';shutil.copytree(p,dest)
 (Path(tmp)/'default-slow-profile').symlink_to(p.parent/'default-slow-profile')
 def refresh():
  (dest/'manifest.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest()for f in dest.iterdir()if f.is_file()and f.name!='manifest.json'}))
 def rejected(label):
  refresh();r=subprocess.run(['python3',str(dest/'verify.py')],capture_output=True,text=True);assert r.returncode!=0,label;print('PASS rejects '+label+' after manifest rehash')
 orig=(dest/'timings.json').read_bytes();rows=json.loads(orig);rows[0]['seconds']+=1;(dest/'timings.json').write_text(json.dumps(rows));rejected('timing mismatch');(dest/'timings.json').write_bytes(orig)
 rows=json.loads(orig);rows[0],rows[1]=rows[1],rows[0];(dest/'timings.json').write_text(json.dumps(rows));rejected('schedule ordering');(dest/'timings.json').write_bytes(orig)
 original=(dest/'summary.json').read_bytes();s=json.loads(original);s[0]['control']['median']+=1;(dest/'summary.json').write_text(json.dumps(s));rejected('summary mismatch');(dest/'summary.json').write_bytes(original)
 unpack=Path(tmp)/'attempts';unpack.mkdir()
 with tarfile.open(dest/'attempts.tar.xz')as t:t.extractall(unpack,filter='data')
 ses=next(unpack.rglob('board.ses'));ses.write_bytes(ses.read_bytes()+b'\n')
 with tarfile.open(dest/'attempts.tar.xz','w:xz')as t:
  for f in sorted(unpack.iterdir()):t.add(f,arcname=f.name)
 rejected('session mismatch')
