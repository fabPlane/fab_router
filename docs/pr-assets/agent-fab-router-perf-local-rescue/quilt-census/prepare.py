"""Prepare a diagnostic-only source copy; never change query decisions or order."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT = Path(__file__).resolve().parents[4]
out = Path(sys.argv[1]).resolve()
assert not out.exists(), 'unused output required'
out.mkdir(parents=True)
source = out / 'source'; source.mkdir()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','HEAD'], cwd=ROOT))) as archive:
    archive.extractall(source, filter='data')
(source/'node_modules').symlink_to(ROOT/'node_modules', target_is_directory=True)
p = source/'src/route/quilt.ts'
original = p.read_text()
s = original
replacements = [
('  const cache = new Map<number, PatchState>();', '  const cache = new Map<number, PatchState>();\n  const meter = ((globalThis as any).__quiltCensus ??= {quilts:0, calls:0, hitsFree:0, hitsBlocked:0, missesFree:0, missesBlocked:0, invalidations:0, emptyInvalidations:0, clears:0, clearedEntries:0, deletes:0, removed:0});\n  meter.quilts++;'),
('    const key = mortonKey(gx, gy);', '    meter.calls++;\n    const key = mortonKey(gx, gy);'),
('    if (cached !== undefined) return cached;', '    if (cached !== undefined) { meter[cached === "free" ? "hitsFree" : "hitsBlocked"]++; return cached; }'),
('    cache.set(key, s);', '    meter[free ? "missesFree" : "missesBlocked"]++;\n    cache.set(key, s);'),
('    if (cache.size === 0) return;', '    meter.invalidations++;\n    if (cache.size === 0) { meter.emptyInvalidations++; return; }'),
('      cache.clear();', '      meter.clears++; meter.clearedEntries += cache.size;\n      cache.clear();'),
('cache.delete(mortonKey(gx, gy));', '{ meter.deletes++; if (cache.delete(mortonKey(gx, gy))) meter.removed++; }')]
for old,new in replacements:
    assert s.count(old)==1, old
    s=s.replace(old,new)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    rel=Path(raw.decode());before=ROOT/rel;after=source/rel
    audit[str(rel)]={'original':hashlib.sha256(before.read_bytes()).hexdigest(),'observer':hashlib.sha256(after.read_bytes()).hexdigest()}
assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/quilt.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'quilt-observer.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/archive).read_bytes()))
