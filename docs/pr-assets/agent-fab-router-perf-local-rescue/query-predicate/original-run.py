from pathlib import Path
import subprocess,json,hashlib,time
w=Path(__file__).resolve().parent
old=w
(w/'stress.ts').write_text(Path('/home/hyper/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/l3-replication/stress.ts').read_text())
input=Path('/home/hyper/bench/boards/ladder/l2-cycle18.dsn')
records=[]
for pair in range(1,4):
 for mode in (['candidate','original'] if pair%2 else ['original','candidate']):
  name=f'{pair}-{mode}'
  with (w/f'{name}.log').open('w') as log:
   r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bun',old/'stress.ts',old/mode,input,w/name],stdout=log,stderr=subprocess.STDOUT)
  assert r.returncode==0,(name,r.returncode)
  result=json.loads((w/name/'result.json').read_text())
  record={'pair':pair,'mode':mode,'seconds':result['seconds'],'ses_sha256':hashlib.sha256((w/name/'board.ses').read_bytes()).hexdigest()}
  records.append(record);(w/'records.json').write_text(json.dumps(records,indent=2)+'\n')
  print(record,flush=True)
reference=json.loads((w/'1-original/result.json').read_text());reference.pop('seconds');reference['report'].pop('wallClockMs',None)
for record in records:
 result=json.loads((w/f"{record['pair']}-{record['mode']}"/'result.json').read_text());result.pop('seconds');result['report'].pop('wallClockMs',None)
 assert result==reference,record
assert len({r['ses_sha256'] for r in records})==1
print('ALL SIX SESSIONS AND NON-TIMING RESULTS IDENTICAL',flush=True)
