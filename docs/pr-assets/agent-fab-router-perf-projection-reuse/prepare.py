# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib, json, subprocess, sys, tarfile
p=Path(__file__).resolve().parent
ref=p/'reference'
w=Path(sys.argv[1]).resolve(); w.mkdir(exist_ok=False,parents=True)
for v in ['control','candidate']:
 (w/v).mkdir()
 with tarfile.open(ref/'source.tar.gz') as t:t.extractall(w/v,filter='data')
(w/'candidate/src/geom/distance.ts').write_bytes((p/'distance-candidate.ts').read_bytes())
audit=json.loads((p/'audit.json').read_text())
for rel,pair in audit.items():
 for v in ['control','candidate']:
  if hashlib.sha256((w/v/rel).read_bytes()).hexdigest()!=pair[v]:raise ValueError(f'source mismatch {v}/{rel}')
(w/'probe.ts').write_bytes((p/'probe.ts').read_bytes())
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun',str(w/'probe.ts')],check=True)
print('PASS: reconstructed both source variants and differential probe')
