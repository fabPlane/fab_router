"""Require the equality-boundary mutation to fail the API corpus."""
from pathlib import Path
import json,shutil,subprocess,sys
here=Path(__file__).resolve().parent
work=Path(sys.argv[1]).resolve();mutant=work/'mutant';mutant.mkdir()
for d in ('src','spec'):shutil.copytree(work/'work/candidate'/d,mutant/d)
(mutant/'node_modules').symlink_to(work/'work/candidate/node_modules',target_is_directory=True)
p=mutant/'src/route/clear.ts';s=p.read_text();old='v <= threshold : v < threshold'
assert s.count(old)==1;p.write_text(s.replace(old,'v <= threshold : v <= threshold'))
with (work/'mutation.log').open('w') as f:
    code=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','60','bun',str(here/'equivalence.ts'),str(work/'work/original'),str(mutant)],stdout=f,stderr=subprocess.STDOUT).returncode
assert code==1,code
(work/'mutation.json').write_text(json.dumps({'inclusiveForStrictExit':code,'expected':1})+'\n')
