"""Bounded sequential replays and required checks on eight assigned cores."""
from pathlib import Path
import json,subprocess,sys
root=Path(__file__).resolve().parents[4];work=Path(sys.argv[1]).resolve()
assert (work/'work/original').is_dir() and not (work/'original1').exists()
exits=[]
def run(name,args,cwd=root):
    with (work/(name+'.log')).open('w') as log:
        code=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5',*args],cwd=cwd,stdout=log,stderr=subprocess.STDOUT).returncode
    exits.append(dict(name=name,exit=code));(work/'exits.json').write_text(json.dumps(exits,indent=2)+'\n')
    assert code==0,(name,code)
for i in (1,2,3):
    for mode in ('original','candidate'):
        run(f'{mode}{i}',['300','bun',str(root/'docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/profile.ts'),str(work/'work'/mode),str(work/'work/input'),str(work/f'{mode}{i}')])
for mode in ('original','candidate'):
    run(f'{mode}-checks',['900','bash','-c','bun run typecheck && bun run check:layers && bun run test'],work/'work'/mode)
# Keep the native archive prerequisites alongside the isolated source trees.
(work/'work/checks-exits.json').write_text(json.dumps({m:{'returncode':next(x['exit'] for x in exits if x['name']==m+'-checks')}for m in ('original','candidate')},indent=2)+'\n')
for mode in ('original','candidate'):
    (work/'work'/f'{mode}-checks.log').write_bytes((work/f'{mode}-checks.log').read_bytes())
