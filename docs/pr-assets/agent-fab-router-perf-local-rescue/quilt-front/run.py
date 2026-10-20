"""Sequential complete engine replays and full checks, with bounded execution."""
from pathlib import Path
import subprocess,sys,json
root=Path(__file__).resolve().parents[4];work=Path(sys.argv[1]).resolve();exits=[]
def run(name,args,cwd=root):
 with (work/(name+'.log')).open('w') as log:
  code=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5',*args],cwd=cwd,stdout=log,stderr=subprocess.STDOUT).returncode
 exits.append({'name':name,'returncode':code});(work/'exits.json').write_text(json.dumps(exits,indent=2)+'\n');assert code==0,name
for i in (1,2,3):
 for label,source in [('original',work/'work/original'),('candidate',work/'work/source')]:
  run(f'{label}{i}',['300','bun',str(root/'docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/profile.ts'),str(source),str(work/'work/input'),str(work/f'{label}{i}')])
for label,source in [('production',work/'work/original'),('candidate',work/'work/source')]:
 run(f'{label}-checks',['900','bash','-c','bun run typecheck && bun run check:layers && bun run test'],source)
