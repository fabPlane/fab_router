"""Create isolated source snapshots; never edit production sources."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path.cwd(); out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=False)
audit={}
for name in subprocess.check_output(['git','ls-files','-z','src','spec']).decode().split('\0'):
 if not name: continue
 data=(root/name).read_bytes(); audit[name]=hashlib.sha256(data).hexdigest()
 for mode in ('before','after'):
  dest=out/mode/name; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
p=out/'after/src/route/visibility-recovery.ts'; s=p.read_text()
changes={
 'const margin=Math.ceil(profile.maxSpacing+h)+1;':'const offset=(kind:number)=>Math.ceil(layout.spacing.get(profile.trackKind,kind,sheet)+h)+1;',
 'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;':'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;const margin=offset(pad.kind);',
 '},margin+track.width/2);':'},offset(track.kind)+track.width/2);',
 'if(b)boxCorners(b,margin);':'if(b)boxCorners(b,offset(barrel.kind));',
}
for a,b in changes.items():
 assert s.count(a)==1,a
 s=s.replace(a,b)
p.write_text(s)
(out/'audit.json').write_text(json.dumps({'source':audit,'changes':changes},indent=2)+'\n')
