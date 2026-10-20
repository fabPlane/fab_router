"""Run required gates on both isolated sources sequentially."""
from pathlib import Path
import json,subprocess,sys,time
p=Path(sys.argv[1]).resolve();exits={}
for mode in ('candidate','original'):
 start=time.monotonic()
 with (p/f'{mode}-checks.log').open('w') as log:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','900','bash','-c','bun run typecheck && bun run check:layers && bun run test'],cwd=p/mode,stdout=log,stderr=subprocess.STDOUT)
 exits[mode]={'returncode':r.returncode,'seconds':time.monotonic()-start}
 (p/'checks-exits.json').write_text(json.dumps(exits,indent=2)+'\n')
 if r.returncode:raise SystemExit(r.returncode)
