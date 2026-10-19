"""Prove controls reject four specific budget-policy regressions, in scratch only."""
from pathlib import Path
import json,subprocess,sys
repo,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False)
relative=Path('docs/pr-assets/agent-fab-router-perf-local-rescue/bounded-point-probe')
source=(repo/relative/'recover.ts').read_text();controls=(repo/relative/'controls.test.ts').read_text()
mutations={
 'reset-work':('maxExpansions:maxWork-work','maxExpansions:maxWork','work exhaustion in original search, enumeration, and alternate'),
 'reset-deadline':('deadline:Math.min(control.deadline??Infinity,localDeadline)','deadline:control.deadline??Number.MAX_VALUE','late or cancelled successful alternate insertion'),
 'free-enumeration':('work++;enumeration++;','enumeration++;','one target budget includes original work, enumeration and alternate'),
 'uncancellable-enumeration':('const r=stopped();if(r)return r;work++;','work++;','enumeration checks cancellation and both absolute deadlines'),
}
rows=[]
for name,(old,new,expected) in mutations.items():
 assert source.count(old)==1,(name,source.count(old))
 root=out/name;asset=root/relative;asset.mkdir(parents=True)
 for path in ('src','spec','test','node_modules'):(root/path).symlink_to(repo/path,target_is_directory=True)
 (asset/'recover.ts').write_text(source.replace(old,new));(asset/'controls.test.ts').write_text(controls)
 run=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun','test',str(asset/'controls.test.ts')],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=130)
 (out/f'{name}.log').write_text(run.stdout)
 assert run.returncode==1 and '(fail) '+expected in run.stdout,(name,run.returncode,run.stdout)
 rows.append({'mutation':name,'exit':run.returncode,'expectedFailingControl':expected})
(out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
