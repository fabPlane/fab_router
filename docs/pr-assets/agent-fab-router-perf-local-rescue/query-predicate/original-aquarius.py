from pathlib import Path
import subprocess,json,hashlib,time
w=Path(__file__).resolve().parent
work=Path((w.parent/'cycle81/work-path.txt').read_text().strip())
records=[]
for pair in range(1,4):
 for mode in (['candidate','original']if pair%2 else ['original','candidate']):
  name=f'aquarius-{pair}-{mode}'
  with (w/f'{name}.jsonl').open('w')as out,(w/f'{name}.log').open('w')as err:
   r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','300','bun',w/'replay.ts',w/mode,work,'1'],stdout=out,stderr=err)
  assert r.returncode==0,(name,r.returncode)
  x=json.loads((w/f'{name}.jsonl').read_text());records.append({'pair':pair,'mode':mode,**x})
  (w/'aquarius-records.json').write_text(json.dumps(records,indent=2)+'\n');print(name,x['seconds'],flush=True)
keys=['settings','input_sha256','bounds_sha256','clear_sha256','distance_sha256','logs','report','statsBefore','statsAfter','ses_sha256']
ref={k:records[0][k]for k in keys};ref['report'].pop('wallClockMs',None)
for r in records:
 x={k:r[k]for k in keys};x['report'].pop('wallClockMs',None);assert x==ref,(r['pair'],r['mode'])
print('ALL SIX SESSIONS/SETTINGS/LOGS/STATS/REPORTS EXCEPT WALL IDENTICAL',flush=True)
