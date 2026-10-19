"""Copy settings into an isolated config directory; only add localRescue=true."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('benchmark',type=Path);p.add_argument('out',type=Path)
a=p.parse_args();a.benchmark=a.benchmark.resolve();a.out=a.out.resolve();a.out.mkdir(exist_ok=False)
config=json.loads((a.benchmark/'configs/fab-router.json').read_text())
for job in config['jobs'].values():
 cmd=job['command'];index=cmd.index('--settings-file')+1
 old=Path(cmd[index].replace('{benchmark}',str(a.benchmark)))
 new=a.out/old.name
 settings=json.loads(old.read_text());settings.setdefault('settings',{})['localRescue']=True
 new.write_text(json.dumps(settings,indent=2)+'\n');cmd[index]=str(new)
(a.out/'fab-router.json').write_text(json.dumps(config,indent=2)+'\n')
