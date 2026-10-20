"""Capture cooperative scheduler controls and deliberate budget/attempt/deadline bypasses.
Usage: python3 validate-recovery-schedule.py SOURCE UNUSED_OUTPUT
"""
import hashlib,json,pathlib,subprocess,sys
source,output=map(lambda s:pathlib.Path(s).resolve(),sys.argv[1:])
output.mkdir()
base=pathlib.Path('docs/pr-assets/agent-fab-router-perf-local-rescue')
schedule=base/'recovery-schedule.ts'
gate=base/'recovery-transaction.ts'
test=pathlib.Path('test/recovery-schedule.test.ts')
captured={p:(source/p).read_bytes() for p in [schedule,gate,test]}
variants=[('control',None,None),
 ('no-expansion-cap','if(expansions>=plan.maxExpansions)throw budget;',''),
 ('no-attempt-cap','regions.slice(0,plan.maxAttempts)','regions'),
 ('no-deadline','if(performance.now()>=deadline)throw budget;',''),
 ('mutable-region','region:{...region}','region')]
rows=[]
for name,old,new in variants:
 dest=output/name;dest.mkdir()
 for entry in ['src','spec']:(dest/entry).symlink_to(source/entry,target_is_directory=True)
 for p,data in captured.items():
  path=dest/p;path.parent.mkdir(parents=True,exist_ok=True)
  text=data.decode()
  if p==schedule and old is not None:
   assert text.count(old)==1
   text=text.replace(old,new)
  path.write_text(text)
 result=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','60','bun','test',str(dest/test)],capture_output=True,text=True,timeout=75)
 log=result.stdout+result.stderr;(output/(name+'.txt')).write_text(log)
 if name=='control':assert result.returncode==0 and '4 pass' in log and '77 expect() calls' in log,log
 else:assert result.returncode==1 and 'expect(received)' in log and 'fail' in log,log
 rows.append({'variant':name,'exit':result.returncode,'expected_outcome_observed':True})
assert all((source/p).read_bytes()==data for p,data in captured.items())
(output/'results.json').write_text(json.dumps({'scope':'Scheduler regressions, not routing benchmarks','sha256':{str(p):hashlib.sha256(data).hexdigest() for p,data in captured.items()},'rows':rows},indent=2)+'\n')
