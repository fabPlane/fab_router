"""Usage: python3 prepare-repro.py ENGINE_GIT NEW_RUN_DIR BASE_REF RIM_REF"""
from pathlib import Path
import json,subprocess,sys
repo,run=map(lambda s:Path(s).resolve(),sys.argv[1:3]);base,rim=sys.argv[3:5]
run.mkdir(exist_ok=False)
for mode in ['original','candidate']:
 p=run/mode;p.mkdir()
 subprocess.run(['tar','-x','-C',str(p)],input=subprocess.check_output(['git','-C',str(repo),'archive',base,'src','spec','test','tools','package.json','tsconfig.json','docs']),check=True)
 (p/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 if mode=='candidate':
  for name in ['src/geom/onboard.ts','test/onboard-invariance.test.ts']:(p/name).write_bytes(subprocess.check_output(['git','-C',str(repo),'show',rim+':'+name]))
for name in ['prepare-native.py','native.py','compare.py','checks.py','profile.py','replay.ts','stress.py','dense-native.py','compare-dense.py','stress.ts']:(run/name).write_bytes((Path(__file__).resolve().parent/name).read_bytes())
(run/'base.txt').write_text(base+'\n')
subprocess.run([sys.executable,run/'prepare-native.py'],check=True)
