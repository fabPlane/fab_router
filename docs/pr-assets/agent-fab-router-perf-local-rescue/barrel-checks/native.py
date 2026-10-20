"""Run fresh complete native sweeps with recovery off/on and verify source stability."""
from pathlib import Path
import subprocess,json,hashlib,sys
root,benchmark,scratch=map(lambda x:Path(x).resolve(),sys.argv[1:]);scratch.mkdir(exist_ok=False)
files=list((root/'src').rglob('*.ts'))+list((root/'spec/types').glob('*.ts'))+[root/'docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting/src/api.ts']
snapshot={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()for p in files}
(scratch/'source-hashes.json').write_text(json.dumps(snapshot,indent=2)+'\n')
for mode,source in [('normal',root),('candidate',root/'docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting')]:
 with (scratch/f'{mode}-native.log').open('w')as log:
  result=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','2400','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source),'--out',str(scratch/f'native-{mode}')],cwd=benchmark,stdout=log,stderr=subprocess.STDOUT,timeout=2450)
 assert result.returncode==0,(mode,result.returncode)
 assert all(hashlib.sha256((root/n).read_bytes()).hexdigest()==v for n,v in snapshot.items())
