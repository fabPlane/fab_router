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
p = source/'src/route/clear.ts'
original = p.read_text()
s = original
replacements = [
('function hitBlocks(layout:', 'function hitBlocksOriginal(layout:'),
('function closerConvex(a: ConvexShape, b: ConvexShape, required: number, orTouching: boolean): boolean {', '''function closerConvex(a: ConvexShape, b: ConvexShape, required: number, orTouching: boolean): boolean {
  if (censusCategory !== null) {
    const key = censusCategory + ":" + a.kind + ":" + b.kind + ":" + (orTouching ? "touch" : "spacing");
    const pairs = (globalThis as any).__clearanceCensus.pairs;
    pairs[key] = (pairs[key] ?? 0) + 1;
  }'''),
('function sameNet(itemNet:', '''let censusCategory: string | null = null;
function hitBlocks(layout: Layout, lattice: Lattice, sheet: number, ref: LatticeItemRef, subject: Subject, profile: Profile, ignore: IgnoreSet, attach: boolean): boolean {
  const meter = ((globalThis as any).__clearanceCensus ??= {calls:{},blocked:{},pairs:{}});
  const category = lattice.itemOf(ref.id)?.cat ?? "missing";
  meter.calls[category] = (meter.calls[category] ?? 0) + 1;
  const previous = censusCategory;
  censusCategory = category;
  try {
    const result = hitBlocksOriginal(layout, lattice, sheet, ref, subject, profile, ignore, attach);
    if (result) meter.blocked[category] = (meter.blocked[category] ?? 0) + 1;
    return result;
  } finally { censusCategory = previous; }
}
function sameNet(itemNet:''')]
for old,new in replacements:
    assert s.count(old)==1, old
    s=s.replace(old,new)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    rel=Path(raw.decode());before=ROOT/rel;after=source/rel
    audit[str(rel)]={'original':hashlib.sha256(before.read_bytes()).hexdigest(),'observer':hashlib.sha256(after.read_bytes()).hexdigest()}
assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/clear.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'clear-observer.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/archive).read_bytes()))
