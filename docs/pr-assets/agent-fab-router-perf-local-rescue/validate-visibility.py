"""Capture visibility regressions and two deliberately broken search controls."""
import hashlib,json,subprocess,sys
from pathlib import Path
root,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False,parents=True)
a=root/'docs/pr-assets/agent-fab-router-perf-local-rescue';helper=a/'visibility-recovery.ts';test=root/'test/recovery-visibility.test.ts'
h=helper.read_text();t=test.read_text();sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
helper_tmp=a/'visibility-mutant.ts';test_tmp=root/'test/visibility-mutant.test.ts'
assert not helper_tmp.exists() and not test_tmp.exists()
rows=[]
try:
 for name,source,expected in [('control',h,0),('no-corners',h.replace('if(pad.net===target.net)continue;','if(pad.net!==undefined)continue;'),1),('no-budget',h.replace('trial.expand();',''),1)]:
  helper_tmp.write_text(source);test_tmp.write_text(t.replace('/visibility-recovery.ts','/visibility-mutant.ts'))
  cmd=['taskset','-c','12-19','nice','-n','10','timeout','180','bun','test',str(test_tmp)]
  run=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  (out/(name+'.log')).write_text(run.stdout)
  assert run.returncode==expected,(name,run.returncode)
  if name=='no-corners':assert 'Expected: "kept"' in run.stdout
  if name=='no-budget':assert 'Expected: "budget"' in run.stdout
  rows.append({'name':name,'exit_code':run.returncode,'expected_outcome_observed':True,'helper_sha256':sha(source),'command':cmd})
finally:
 helper_tmp.unlink(missing_ok=True);test_tmp.unlink(missing_ok=True)
assert helper.read_text()==h and test.read_text()==t
(out/'helper.ts.txt').write_text(h);(out/'test.ts.txt').write_text(t)
(out/'results.json').write_text(json.dumps({'helper_sha256':sha(h),'test_sha256':sha(t),'rows':rows},indent=2)+'\n')
