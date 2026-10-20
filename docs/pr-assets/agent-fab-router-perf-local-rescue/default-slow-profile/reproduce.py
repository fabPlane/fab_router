"""Run sequential unprofiled/profiled default-setting replays. New output only.
Usage: python3 reproduce.py SOURCE_DIR NEW_OUTPUT_DIR
SOURCE_DIR must match audit.json's immutable source_ref (src/ and spec/).
"""
from pathlib import Path
import sys,subprocess,json,hashlib
p=Path(__file__).resolve().parent
source,out=map(lambda x:Path(x).resolve(),sys.argv[1:])
for f,h in json.loads((p/'audit.json').read_text())['source_hashes'].items():
 assert hashlib.sha256((source/f).read_bytes()).hexdigest()==h,('source mismatch',f)
out.mkdir(exist_ok=False)
for case in json.loads((p/'audit.json').read_text())['inputs']:
 for mode in ['unprofiled','profiled']:
  name=f'{case}-{mode}'
  cmd=['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','180','bun']
  if mode=='profiled':cmd+=['--cpu-prof','--cpu-prof-dir',str(out),'--cpu-prof-name',name+'.cpuprofile']
  cmd += [str(p/'replay.ts'),str(source),str(p/case),str(out/name)]
  with (out/(name+'.log')).open('w') as log:
   subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=True)
  print(name,'complete',flush=True)
