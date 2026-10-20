"""Prepare isolated original/candidate trees; production stays unchanged."""
import gzip, hashlib, io, json, subprocess, sys, tarfile
from pathlib import Path
root=Path(__file__).resolve().parents[4]
out=Path(sys.argv[1]).resolve(); out.mkdir(exist_ok=False,parents=True)
audit={}
for label in ['original','candidate']:
    dest=out/label;dest.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','HEAD'],cwd=root))) as t:t.extractall(dest,filter='data')
    (dest/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
p=out/'candidate/src/route/search.ts'
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','90','bun',str(Path(__file__).with_name('verify.ts')),str(out/'parity.json'),str(p)],cwd=root,check=True)
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=root).split(b'\0'):
    if not raw:continue
    rel=raw.decode();audit[rel]={k:hashlib.sha256((out/k/rel).read_bytes()).hexdigest() for k in ['original','candidate']}
assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/route/search.ts']
(out/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'search-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=root/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,arc in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/arc).read_bytes()))
