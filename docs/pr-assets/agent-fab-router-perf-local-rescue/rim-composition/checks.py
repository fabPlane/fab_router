from pathlib import Path
import subprocess,json,time
w=Path(__file__).resolve().parent
start=time.monotonic()
with (w/'checks.log').open('w') as log:
 for command in [['bun','run','typecheck'],['bun','run','check:layers'],['bun','run','test']]:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','1800',*command],cwd=w/'candidate',stdout=log,stderr=subprocess.STDOUT)
  print(command,r.returncode,flush=True)
  if r.returncode:raise SystemExit(r.returncode)
(w/'checks-exit.json').write_text(json.dumps({'returncode':0,'wall_s':time.monotonic()-start})+'\n')
