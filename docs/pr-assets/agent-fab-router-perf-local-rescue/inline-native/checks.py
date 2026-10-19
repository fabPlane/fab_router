from pathlib import Path
import subprocess,json,time,sys
b=Path(sys.argv[1]).resolve();repo=Path(sys.argv[2]).resolve()
rows=[]
for mode,root in [('candidate',b/'source/candidate'),('production',repo)]:
 with (b/(mode+'-checks.log')).open('w') as log:
  for command in [['bun','run','typecheck'],['bun','run','check:layers'],['bun','run','test']]:
   start=time.monotonic();r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','900',*command],cwd=root,stdout=log,stderr=subprocess.STDOUT)
   rows.append(dict(mode=mode,command=command,returncode=r.returncode,seconds=time.monotonic()-start));(b/'checks-exits.json').write_text(json.dumps(rows,indent=2)+'\n')
   if r.returncode:raise SystemExit(r.returncode)
