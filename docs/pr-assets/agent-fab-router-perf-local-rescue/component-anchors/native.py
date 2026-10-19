"""Run complete native 26x3 comparisons with recovery enabled on each source."""
from pathlib import Path
import hashlib,json,subprocess,sys
before,after,bench,out=map(lambda s:Path(s).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False)
for mode,source in [('before',before),('after',after)]:
 hashes={str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest()for top in ('src','spec/types','entry')for p in sorted((source/top).rglob('*'))if p.is_file()}
 with (out/f'{mode}.log').open('w')as log:
  run=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','2400','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source/'entry'),'--out',str(out/mode)],cwd=bench,stdout=log,stderr=subprocess.STDOUT,timeout=2450)
 assert run.returncode==0,(mode,run.returncode)
 assert all(hashlib.sha256((source/p).read_bytes()).hexdigest()==v for p,v in hashes.items())
 (out/f'{mode}-source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
 print(mode,'complete',flush=True)
