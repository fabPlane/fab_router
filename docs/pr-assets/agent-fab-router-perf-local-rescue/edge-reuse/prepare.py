"""Observe repeated exact edge shaping without changing search, charging or results."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path.cwd();out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
audit={}
for name in subprocess.check_output(['git','ls-files','-z','src','spec']).decode().split('\0'):
 if not name:continue
 data=(root/name).read_bytes();audit[name]=hashlib.sha256(data).hexdigest()
 p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
p=out/'src/route/visibility-recovery.ts';s=p.read_text()
needle='    if(!leg.ok||!copperWithinRegion'
assert s.count(needle)==1
s=s.replace(needle,"    (globalThis as any).__edgeReuse?.push({key:JSON.stringify([sheet,nodes[current],nodes[next]]),result:JSON.stringify(leg)});\n"+needle)
p.write_text(s)
recorded=Path(__file__).resolve().parent/'source-audit.json'
result={'source':audit,'observer':hashlib.sha256(p.read_bytes()).hexdigest()}
if recorded.exists():assert result==json.loads(recorded.read_text()),'Source drift'
(out/'audit.json').write_text(json.dumps({'source':audit,'observer':hashlib.sha256(p.read_bytes()).hexdigest()},indent=2)+'\n')
