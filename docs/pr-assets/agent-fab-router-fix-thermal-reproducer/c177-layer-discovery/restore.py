"""Restore immutable source bytes from the evidence archive for a fresh run."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'native/summary.json').read_text())
for role in ('source','input'):
 d=x.results/role;d.mkdir(exist_ok=False)
 matches=[(name,digest) for name,digest in z['source_sha256'].items() if '/'+role+'/' in name];assert len(matches)==3
 for name,digest in matches:
  data=(x.results/'native/sources'/digest).read_bytes();assert hashlib.sha256(data).hexdigest()==digest
  (d/('board'+Path(name).suffix)).write_bytes(data)
print('PASS: exact archived source, input and sidecars restored')
