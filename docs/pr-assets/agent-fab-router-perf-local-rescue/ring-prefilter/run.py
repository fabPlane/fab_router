from pathlib import Path
import subprocess,json,gzip,hashlib,time,sys
from verify import logs
w=Path(sys.argv[1]).resolve();r=Path(__file__).resolve().parents[4];rows=[]
for repeat in range(3):
 for mode in (['original','candidate'] if repeat%2==0 else ['candidate','original']):
  out=w/f'{mode}-{repeat}'
  cmd=['taskset','-c','12-19','nice','-n','10','timeout','240','bun',str(r/'docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/profile.ts'),str(w/mode),str(w/'input'),str(out)]
  subprocess.run(cmd,check=True,timeout=250)
  x=json.loads((out/'result.json').read_text());rows.append(dict(mode=mode,repeat=repeat,**x))
  print(mode,repeat,x['seconds'],flush=True)
ref=json.loads(gzip.decompress((r/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile/replay.json.gz').read_bytes()))
for x in rows:
 for field in ['inputSha256','settings','sesSha256','stats']:
  assert x[field]==ref[field],field
 report=x['report'].copy();report.pop('wallClockMs',None)
 rr=ref['report'].copy();rr.pop('wallClockMs',None)
 assert report==rr,'report'
base=rows[0]
assert all(logs(x['logs'])==logs(base['logs']) for x in rows)
(w/'replays.json').write_text(json.dumps({'scope':'Complete engine replay only; no fresh native check or full-suite score','rows':rows},indent=2)+'\n')
print('ALL SIX replay session/settings/stats/report/log parity PASS',flush=True)
