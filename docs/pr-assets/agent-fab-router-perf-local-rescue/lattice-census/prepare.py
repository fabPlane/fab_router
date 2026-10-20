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
p = source/'src/lattice/grid.ts'
original = p.read_text()
s = original
replacements = [
('    const out: LatticeItemRef[] = [];\n    const g = sheets.get(sheet);', '''    const meter = ((globalThis as any).__latticeCensus ??= {queries:0,missing:0,cells:0,nonempty:0,visits:0,duplicates:0,bucketTests:0,shelfTests:0,bucketHits:0,shelfHits:0,filterRejected:0,results:0,histogram:{}});
    meter.queries++;
    const out: LatticeItemRef[] = [];
    const g = sheets.get(sheet);'''),
('    if (!g) return out;', '    if (!g) { meter.missing++; return out; }'),
('      if (filter && !filter(ref)) return;', '      if (filter && !filter(ref)) { meter.filterRejected++; return; }'),
('          const list = g.cells.get(keyOf(cx, cy));', '          meter.cells++;\n          const list = g.cells.get(keyOf(cx, cy));'),
('          if (!list) continue;', '          if (!list) continue;\n          meter.nonempty++;'),
('            if (sStamp[s] === gen) continue;', '            meter.visits++;\n            if (sStamp[s] === gen) { meter.duplicates++; continue; }'),
('            if (test(s)) push(s);', '            meter.bucketTests++;\n            if (test(s)) { meter.bucketHits++; push(s); }'),
('    for (const s of g.shelf) if (test(s)) push(s);', '    for (const s of g.shelf) { meter.shelfTests++; if (test(s)) { meter.shelfHits++; push(s); } }'),
('    out.sort((a, b) => a.id - b.id || (a.leg ?? NO_LEG) - (b.leg ?? NO_LEG));', '''    meter.results += out.length;
    const bin = out.length < 2 ? String(out.length) : out.length < 8 ? "2-7" : out.length < 32 ? "8-31" : out.length < 128 ? "32-127" : "128+";
    meter.histogram[bin] = (meter.histogram[bin] ?? 0) + 1;
    out.sort((a, b) => a.id - b.id || (a.leg ?? NO_LEG) - (b.leg ?? NO_LEG));''')]
for old,new in replacements:
    assert s.count(old)==1, old
    s=s.replace(old,new)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    rel=Path(raw.decode());before=ROOT/rel;after=source/rel
    audit[str(rel)]={'original':hashlib.sha256(before.read_bytes()).hexdigest(),'observer':hashlib.sha256(after.read_bytes()).hexdigest()}
assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/lattice/grid.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'grid-observer.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/archive).read_bytes()))
