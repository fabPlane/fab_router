from pathlib import Path
import subprocess,time,json,statistics
w=Path(__file__).resolve().parent
while len((w/'probe.log').read_text().splitlines())<6:time.sleep(2)
assert all(line.endswith(' 0')for line in (w/'probe.log').read_text().splitlines())
rows=[]
for pair in range(3):
 for mode in ['original','candidate']:
  for iteration,line in enumerate((w/f'probe-{pair}-{mode}.jsonl').read_text().splitlines()):
   r=json.loads(line);r.update(pair=pair,mode=mode,iteration=iteration);rows.append(r)
assert len(rows)==12
for key in ['ses_sha256','statsAfter','settings','input_sha256']:
 assert len({json.dumps(r[key],sort_keys=True)for r in rows})==1,key
assert len({json.dumps({k:v for k,v in r['report'].items()if k!='wallClockMs'},sort_keys=True)for r in rows})==1
summary={m:{str(i):{'seconds':[r['seconds']for r in rows if r['mode']==m and r['iteration']==i]}for i in [0,1]}for m in ['original','candidate']}
for v in summary.values():
 for r in v.values():r.update(median=statistics.median(r['seconds']),p95=max(r['seconds']))
(w/'probe-summary.json').write_text(json.dumps({'timing':summary,'all12sessionsReportsStatsIdentical':True},indent=2)+'\n')
print(json.dumps(summary),flush=True)
subprocess.run(['python3',w/'native.py'],check=True)
