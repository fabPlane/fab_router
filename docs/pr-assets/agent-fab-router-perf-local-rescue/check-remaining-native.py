"""Native-check captured before/after sessions without repairing their copper.
Usage: python3 check-remaining-native.py FAB_PCB_CHECKOUT MEASUREMENTS UNUSED_OUT
This is one case, three same-seed repeats, not a complete candidate suite.
"""
import hashlib,json,subprocess,sys,time
from pathlib import Path
root,measurements,out=map(lambda p:Path(p).resolve(),sys.argv[1:]);out.mkdir(parents=True,exist_ok=False)
a=root/'benchmarks/autorouter';h=a/'harness';fixture=a/'cases/paperino-hw-paperino-shield-j4'
data=json.loads(measurements.read_text());assert len(data['rows'])==3
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
protected={str(p):sha(p) for p in [*fixture.iterdir(),h/'dsn-path.py',h/'native-check-v4.3.py'] if p.is_file()}
results=[]
for row in data['rows']:
 for mode in ['before','after']:
  d=out/f"repeat-{row['repeat']}-{mode}";d.mkdir();steps=[]
  def run(args,label):
   start=time.monotonic();p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
   (d/(label+'.log')).write_text(p.stdout);steps.append(dict(args=args,exit_code=p.returncode,seconds=time.monotonic()-start))
   assert p.returncode==0,(label,p.returncode,p.stdout)
  run(['/usr/bin/python3',str(h/'dsn-path.py'),'export','--input-dir',str(fixture),'--work-dir',str(d)],'export')
  assert sha(d/'board.dsn')==data['inputSha256']
  (d/'board.ses').write_text(row[mode+'Ses'])
  assert sha(d/'board.ses')==row[mode+'Sha256']
  run(['/usr/bin/python3',str(h/'dsn-path.py'),'import','--input-dir',str(fixture),'--work-dir',str(d),'--output-pcb',str(d/'output.kicad_pcb')],'import')
  run(['/usr/bin/python3',str(h/'native-check-v4.3.py'),'--fixture',str(fixture),'--output',str(d/'output.kicad_pcb'),'--out',str(d/'check.json')],'check')
  c=json.loads((d/'check.json').read_text());assert c['integrity_pass'] and c['new_errors']==0
  assert c['opens']==len(row[mode])
  results.append(dict(repeat=row['repeat'],mode=mode,steps=steps,check=c,session_sha256=sha(d/'board.ses'),artifacts={p.name:sha(p) for p in d.iterdir() if p.is_file()}))
  print(json.dumps({k:c[k] for k in ['opens','new_errors','via_count','track_length_mm']}),flush=True)
assert all(sha(Path(p))==v for p,v in protected.items())
(out/'results.json').write_text(json.dumps(dict(scope='One frozen case; three same-seed engine repeats; before/after native checks; no full-suite gain claim',measurements_sha256=sha(measurements),protected_sha256=protected,rows=results),indent=2)+'\n')
