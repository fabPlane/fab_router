"""Profile one L3 replay per immutable source; profiled times are not benchmarks.
Usage: python3 reproduce.py ENGINE_REPO INPUT_DSN NEW_OUTPUT_DIR
"""
from pathlib import Path
import subprocess,sys
repo,input,out=map(lambda x:Path(x).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False)
asset=Path(__file__).resolve().parent.parent/'l3-replication'
for mode,ref in [('candidate','a3a2d38ddea104e4dff4fec8551d27260710a718'),('original','49bfc72a')]:
 source=out/f'{mode}-source';source.mkdir()
 subprocess.run(['tar','-x','-C',source],input=subprocess.check_output(['git','-C',repo,'archive',ref,'src','spec','package.json','tsconfig.json']),check=True)
 (source/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 with (out/f'{mode}.log').open('w') as log:
  subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bun','--cpu-prof','--cpu-prof-dir',str(out),'--cpu-prof-name',f'{mode}.cpuprofile',str(asset/'stress.ts'),str(source),str(input),str(out/mode)],stdout=log,stderr=subprocess.STDOUT,check=True)
