"""Run three counterbalanced L3 pairs from immutable Git source snapshots.
Usage: python3 reproduce.py ENGINE_REPO L3_DSN NEW_RUN_DIR
Dependencies: bun, taskset, nice, timeout, git, tar; repo node_modules installed.
"""
from pathlib import Path
import hashlib,json,subprocess,sys
repo,input,w=map(lambda p:Path(p).resolve(),sys.argv[1:]);w.mkdir(exist_ok=False)
asset=Path(__file__).resolve().parent
manifest={'input_sha256':hashlib.sha256(input.read_bytes()).hexdigest(),'sources':{}}
for mode,ref in [('original','49bfc72a'),('candidate','a3a2d38ddea104e4dff4fec8551d27260710a718')]:
 p=w/mode;p.mkdir()
 subprocess.run(['tar','-x','-C',p],input=subprocess.check_output(['git','-C',repo,'archive',ref,'src','spec','package.json','tsconfig.json']),check=True)
 (p/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 manifest['sources'][mode]=subprocess.check_output(['git','-C',repo,'rev-parse',ref],text=True).strip()
(w/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
records=[]
for pair in range(1,4):
 for mode in (['candidate','original'] if pair%2 else ['original','candidate']):
  name=f'{pair}-{mode}'
  with (w/f'{name}.log').open('w') as log:
   subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bun',asset/'stress.ts',w/mode,input,w/name],stdout=log,stderr=subprocess.STDOUT,check=True)
  result=json.loads((w/name/'result.json').read_text())
  records.append({'pair':pair,'mode':mode,'seconds':result['seconds'],'ses_sha256':hashlib.sha256((w/name/'board.ses').read_bytes()).hexdigest()})
  (w/'records.json').write_text(json.dumps(records,indent=2)+'\n');print(name,result['seconds'],flush=True)
subprocess.run([sys.executable,asset/'verify.py',w],check=True)
