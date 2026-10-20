"""Isolated deferred search: original coordinator coverage first, one ledger/deadline."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path.cwd();out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
audit={}
for name in subprocess.check_output(['git','ls-files','-z','src','spec']).decode().split('\0'):
 if not name:continue
 data=(root/name).read_bytes();audit[name]=hashlib.sha256(data).hexdigest()
 for mode in ['before','after']:
  p=out/mode/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
p=out/'after/src/route/visibility-recovery.ts';s=p.read_text().replace('export function proposeVisibility(', 'export function proposeActualVisibility(')
s=s.replace('const margin=Math.ceil(profile.maxSpacing+h)+1;','const offset=(kind:number)=>Math.ceil(layout.spacing.get(profile.trackKind,kind,sheet)+h)+1;')
for a,b in {
 'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;':'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;const margin=offset(pad.kind);',
 '},margin+track.width/2);':'},offset(track.kind)+track.width/2);',
 'if(b)boxCorners(b,margin);':'if(b)boxCorners(b,offset(barrel.kind));',
}.items():
 assert s.count(a)==1;s=s.replace(a,b)
q=p.with_name('actual-visibility-recovery.ts');q.write_text(s)
p=out/'after/src/route/recovery-point-component.ts';s=p.read_text()
s="import {proposeActualVisibility} from './actual-visibility-recovery.ts';\n"+s
s=s.replace('const search=(anchor:Target):Status=>{','const search=(anchor:Target,actual=false):Status=>{')
s=s.replace('proposals.push(proposeVisibility(', 'proposals.push((actual?proposeActualVisibility:proposeVisibility)(')
needle=" return finish('exhausted');\n}"
assert s.count(needle)==1
s=s.replace(needle," for(const anchor of [target,...pairs]){\n  const status=search(anchor,true);if(status!=='exhausted')return finish(status);\n }\n"+needle)
p.write_text(s)
changed={str(p.relative_to(out/'after')):hashlib.sha256(p.read_bytes()).hexdigest() for p in [p,q]}
result={'source':audit,'candidate':changed}
recorded=Path(__file__).resolve().parent/'source-audit.json'
if recorded.exists():assert result==json.loads(recorded.read_text()),'Source drift'
(out/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(out)
