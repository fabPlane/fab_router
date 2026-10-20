"""Capture research collector controls and an omitted copper-corner regression."""
import hashlib,json,subprocess,sys
from pathlib import Path
root,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False,parents=True)
a=root/'docs/pr-assets/agent-fab-router-perf-local-rescue';helper=a/'recover-remaining.ts';test=root/'test/recovery-remaining.test.ts'
h=helper.read_text();t=test.read_text();sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
helper_tmp=a/'remaining-mutant.ts';test_tmp=root/'test/remaining-mutant.test.ts'
assert not helper_tmp.exists() and not test_tmp.exists()
rows=[]
try:
 for name,source,expected in [('control',h,0),('no-copper',h.replace('trial,512,includeCopperCorners)', 'trial,512,false)'),1)]:
  helper_tmp.write_text(source);test_tmp.write_text(t.replace('/recover-remaining.ts','/remaining-mutant.ts'))
  cmd=['taskset','-c','12-19','nice','-n','10','timeout','180','bun','test',str(test_tmp)]
  run=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  (out/(name+'.log')).write_text(run.stdout)
  assert run.returncode==expected,(name,run.returncode)
  if name=='no-copper':assert 'optional copper corners discover' in run.stdout and '"exhausted"' in run.stdout
  rows.append({'name':name,'exit_code':run.returncode,'expected_outcome_observed':True,'helper_sha256':sha(source),'command':cmd})
finally:
 helper_tmp.unlink(missing_ok=True);test_tmp.unlink(missing_ok=True)
assert helper.read_text()==h and test.read_text()==t
(out/'helper.ts.txt').write_text(h);(out/'test.ts.txt').write_text(t)
(out/'results.json').write_text(json.dumps({'helper_sha256':sha(h),'test_sha256':sha(t),'rows':rows},indent=2)+'\n')
