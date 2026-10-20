"""Check archive integrity, production source identity and report replay."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
base=Path(__file__).resolve().parent; root=base.parents[3]
for name,digest in json.loads((base/'manifest.json').read_text()).items():
 assert hashlib.sha256((base/name).read_bytes()).hexdigest()==digest,name
for name,digest in json.loads((base/'source-audit.json').read_text())['source'].items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)
 subprocess.run(['python3',str(base/'report.py'),str(base/'results.json.gz'),str(p)],check=True)
 subprocess.run(['rsvg-convert','-w','1600',str(p/'work.svg'),'-o',str(p/'work.png')],check=True)
 for name in ['summary.json','cases.md','work.svg','work.png']:
  assert (p/name).read_bytes()==(base/name).read_bytes(),name
print('PASS: manifest, source hashes, report and PNG replay')
