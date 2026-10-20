# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,sys,tarfile,subprocess
p=Path(__file__).resolve().parent;ref=p.parent/'default-slow-profile';w=Path(sys.argv[1]).resolve();w.mkdir(exist_ok=False)
audit=json.loads((p/'source-audit.json').read_text())
for v in ['control','candidate']:
 (w/v).mkdir()
 with tarfile.open(ref/'source.tar.gz')as t:t.extractall(w/v,filter='data')
subprocess.run([sys.executable,str(p/'prepare.py'),str(w)],check=True)
for v in audit:
 actual={str(f.relative_to(w/v)):hashlib.sha256(f.read_bytes()).hexdigest()for directory in ['src','spec']for f in sorted((w/v/directory).rglob('*'))if f.is_file()}
 assert actual==audit[v],v
(w/'probe.ts').write_bytes((p/'probe.ts').read_bytes())
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','60','bun',str(w/'probe.ts'),str(w/'candidate')],check=True)
if '--prepare-only'in sys.argv:sys.exit(0)
rows=[]
for case in ['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']:
 for repeat in range(3):
  for v in (['control','candidate']if repeat%2==0 else ['candidate','control']):
   name=f'{case}-{repeat}-{v}'
   with (w/(name+'.log')).open('w')as log:subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','180','bun',str(ref/'replay.ts'),str(w/v),str(ref/case),str(w/name)],stdout=log,stderr=subprocess.STDOUT,check=True)
   rows.append(dict(case=case,repeat=repeat,variant=v,seconds=json.loads((w/name/'timing.json').read_text())['seconds']))
   (w/'timings.json').write_text(json.dumps(rows,indent=2)+'\n');print(name,rows[-1]['seconds'],flush=True)
