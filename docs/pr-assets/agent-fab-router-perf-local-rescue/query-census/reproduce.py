"""Reconstruct guarded instrumented source, then replay each case once. New output only."""
from pathlib import Path
import tarfile,gzip,json,hashlib,subprocess,sys
p=Path(__file__).resolve().parent;ref=p.parent/'default-slow-profile'
out=Path(sys.argv[1]).resolve();out.mkdir(exist_ok=False);source=out/'source';source.mkdir()
with tarfile.open(ref/'source.tar.gz') as t:t.extractall(source,filter='data')
base=json.loads((ref/'audit.json').read_text())['source_hashes']
for f,h in base.items():assert hashlib.sha256((source/f).read_bytes()).hexdigest()==h,f
(source/'src/lattice/grid.ts').write_bytes(gzip.decompress((p/'instrumented-grid.ts.gz').read_bytes()))
for f,h in json.loads(gzip.decompress((p/'source-audit.json.gz').read_bytes())).items():assert hashlib.sha256((source/f).read_bytes()).hexdigest()==h,f
if '--prepare-only' in sys.argv[2:]:
 print('PASS complete reconstructed source hashes');sys.exit(0)
for case,meta in json.loads((ref/'audit.json').read_text())['inputs'].items():
 for f,h in meta['hashes'].items():assert hashlib.sha256((ref/case/f).read_bytes()).hexdigest()==h,(case,f,'input hash')
 with (out/(case+'.log')).open('w') as log:
  subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','180','bun',str(ref/'replay.ts'),str(source),str(ref/case),str(out/case)],stdout=log,stderr=subprocess.STDOUT,check=True)
 print(case,'complete',flush=True)
