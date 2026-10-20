"""Audit the complete diagnostic src/spec tree against the fixed control, including Unicode paths."""
import hashlib,json,subprocess,sys
from pathlib import Path
control,source,output=map(lambda p:Path(p).resolve(),sys.argv[1:])
if output.exists():raise SystemExit('output must not exist')
files=subprocess.check_output(['git','-C',str(control),'ls-tree','-r','-z','--name-only','69cf598','src','spec']).decode().rstrip('\0').split('\0')
expected={};observed={}
for name in files:
    data=subprocess.check_output(['git','-C',str(control),'show',f'69cf598:{name}'])
    expected[name]=hashlib.sha256(data).hexdigest()
    observed[name]=hashlib.sha256((source/name).read_bytes()).hexdigest()
assert [name for name in files if expected[name]!=observed[name]]==['src/route/passes.ts']
actual=sorted(str(p.relative_to(source)) for directory in ['src','spec'] for p in (source/directory).rglob('*') if p.is_file())
extras=sorted(set(actual)-set(files))
assert not (set(files)-set(actual))
assert all(name.startswith('spec/acceptance/out/') and name.endswith('.csv') for name in extras)
output.write_text(json.dumps({'control_commit':'69cf598','changed_files':['src/route/passes.ts'],'copied_ignored_acceptance_reports':extras,'control_sha256':expected,'diagnostic_sha256':observed},indent=2)+'\n')
print(len(files),'source/spec files audited; only diagnostic counters differ')
