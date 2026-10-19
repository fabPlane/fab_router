"""Append exact-kind proposal corners AFTER all original corners, scratch only."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path.cwd();out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
recorded=Path(__file__).resolve().parent/'source-audit.json'
expected=json.loads(recorded.read_text()) if recorded.exists() else None
audit={}
for name in subprocess.check_output(['git','ls-files','-z','src','spec']).decode().split('\0'):
 if not name:continue
 data=(root/name).read_bytes();audit[name]=hashlib.sha256(data).hexdigest()
 if expected:assert audit[name]==expected['source'][name],name
 for mode in ['before','after']:
  p=out/mode/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
p=out/'after/src/route/visibility-recovery.ts';s=p.read_text()
start=s.index('  const margin=Math.ceil(profile.maxSpacing+h)+1;')
end=s.index('  totalNodes+=nodes.length;',start)
original=s[start:end]
extra=original.replace('const margin=Math.ceil(profile.maxSpacing+h)+1;',
 'const offset=(kind:number)=>Math.ceil(layout.spacing.get(profile.trackKind,kind,sheet)+h)+1;')
changes={
 'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;':'const b=padBoundsOn(layout,pad,sheet);if(!b)continue;const margin=offset(pad.kind);',
 '},margin+track.width/2);':'},offset(track.kind)+track.width/2);',
 'if(b)boxCorners(b,margin);':'if(b)boxCorners(b,offset(barrel.kind));',
}
for a,b in changes.items():
 assert extra.count(a)==1,a
 extra=extra.replace(a,b)
# Same add(), key set, 512 cap and charged trial.expand(). No budget reset.
s=s[:end]+'  // Experimental append-only enrichment; originals retain order and capacity priority.\n'+extra+s[end:]
p.write_text(s)
if expected:
 assert audit==expected['source'],'Source member set changed'
 assert hashlib.sha256(s.encode()).hexdigest()==expected['candidateSha256'],'Candidate changed'
(out/'audit.json').write_text(json.dumps({'source':audit,'originalBlockSha256':hashlib.sha256(original.encode()).hexdigest(),'appendedBlock':extra,'candidateSha256':hashlib.sha256(s.encode()).hexdigest()},indent=2)+'\n')
print(out)
