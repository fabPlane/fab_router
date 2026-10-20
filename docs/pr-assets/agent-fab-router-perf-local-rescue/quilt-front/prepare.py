"""Prepare a isolated bounded front-cache candidate; the Map remains authoritative."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT = Path(__file__).resolve().parents[4]
out = Path(sys.argv[1]).resolve()
assert not out.exists(), 'unused output required'
out.mkdir(parents=True)
source = out / 'source'; source.mkdir()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','d62ccee9'], cwd=ROOT))) as archive:
    archive.extractall(source, filter='data')
(source/'node_modules').symlink_to(ROOT/'node_modules', target_is_directory=True)
p = source/'src/route/quilt.ts'
original_hashes = {str(Path(raw.decode())):hashlib.sha256((source/Path(raw.decode())).read_bytes()).hexdigest() for raw in subprocess.check_output(['git','ls-tree','-r','--name-only','-z','d62ccee9','src','spec','test'],cwd=ROOT).split(b'\0') if raw}
original = p.read_text()
s = original
replacements = [('  const cache = new Map<number, PatchState>();', '  const cache = new Map<number, PatchState>();\n  const keys = new Float64Array(1024);\n  const states = new Uint8Array(1024);'), ('    const cached = cache.get(key);\n    if (cached !== undefined) return cached;', '    const slot = ((gx & 1023) ^ Math.imul(gy, 31)) & 1023;\n    if (states[slot] && keys[slot] === key) return states[slot] === 1 ? "free" : "blocked";\n    const cached = cache.get(key);\n    if (cached !== undefined) {\n      keys[slot] = key; states[slot] = cached === "free" ? 1 : 2;\n      return cached;\n    }'), ('    cache.set(key, s);', '    cache.set(key, s);\n    keys[slot] = key; states[slot] = free ? 1 : 2;'), ('    if (cache.size === 0) return;', '    states.fill(0);\n    if (cache.size === 0) return;')]
for old,new in replacements:
    assert s.count(old)==1, old
    s=s.replace(old,new)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-tree','-r','--name-only','-z','d62ccee9','src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    rel=Path(raw.decode());before=ROOT/rel;after=source/rel
    audit[str(rel)]={'original':original_hashes[str(rel)],'observer':hashlib.sha256(after.read_bytes()).hexdigest()}
assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/quilt.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'quilt-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/archive).read_bytes()))

(out/"replacements.json").write_text(json.dumps(replacements,indent=2)+"\n")
# Native comparison uses two isolated engine snapshots and identical wrappers.
control=out/'original';control.mkdir()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','d62ccee9'],cwd=ROOT))) as archive:
    archive.extractall(control,filter='data')
(control/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
(out/'candidate').symlink_to(source,target_is_directory=True)
