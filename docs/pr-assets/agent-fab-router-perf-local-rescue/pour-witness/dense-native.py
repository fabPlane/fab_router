"""Native-check current and disposable multi-witness recovery, both enabled, fixed two-pass/600-second budgets."""
import argparse,argparse as ap,importlib.util,json,os,hashlib,subprocess,time,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
for name in ['benchmark','baseline','candidate','fixture','out']:p.add_argument(name,type=Path)
a=p.parse_args()
for name in vars(a):setattr(a,name,getattr(a,name).resolve())
a.out.mkdir(exist_ok=False)
runner_path=a.benchmark/'harness/runner-scoring-v2.py'
sys.path.insert(0,str(runner_path.parent))
spec=importlib.util.spec_from_file_location('dense_runner',runner_path)
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
configs={}
for version in ['before','after']:
 d=a.out/('config-'+version);d.mkdir()
 cfg=json.loads((a.benchmark/'configs/fab-router.json').read_text().replace('{benchmark}',str(a.benchmark)))
 for job in cfg['jobs'].values():
  cmd=job['command'];index=cmd.index('--settings-file')+1
  old=Path(cmd[index]);new=d/old.name;settings=json.loads(old.read_text())
  settings.setdefault('settings',{}).update(timeBudgetMs=600000,maxPasses=2,optimizerEnabled=False,fanoutEnabled=False,strictDrc=True,neckWidthUm=0)
  settings['settings']['localRecovery']=True
  new.write_text(json.dumps(settings,indent=2)+'\n');cmd[index]=str(new)
 (d/'fab-router.json').write_text(json.dumps(cfg,indent=2)+'\n');configs[version]=d
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
controls={'fixture_sha256':{f.name:sha(f) for f in a.fixture.iterdir() if f.is_file()},'runner_sha256':sha(runner_path),'allowed_cpus':sorted(os.sched_getaffinity(0)),'sources':{}}
for version,source in [('before',a.baseline),('after',a.candidate)]:
 controls['sources'][version]={'commit':(source/'.source-commit').read_text().strip() if (source/'.source-commit').exists() else subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip(),'src':{str(f.relative_to(source)):sha(f) for f in (source/'src').rglob('*') if f.is_file()}}
(a.out/'controls.json').write_text(json.dumps(controls,indent=2)+'\n')
rows=[]
stamp=str(time.time_ns())
for repeat in range(1,4):
 for version in (['before','after'] if repeat%2 else ['after','before']):
  source=a.baseline if version=='before' else a.candidate
  os.environ['FAB_ROUTER_MODULE']=str(source/'src/api.ts')
  rec=runner.run(ap.Namespace(out=a.out/'runs',attempt=f'public-recovery-dense-{stamp}-{version}-{repeat}',router='fab-router',fixture=a.fixture,seed=repeat,config_dir=configs[version]))
  check=a.out/'runs'/rec['attempt']/'fab-router/check.json'
  rows.append({'version':version,'repeat':repeat,'record':rec,'check':json.loads(check.read_text()) if check.exists() else None})
  (a.out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
  print(version,repeat,rec['status'],rec.get('route_pipeline_seconds'),rows[-1]['check'],flush=True)
