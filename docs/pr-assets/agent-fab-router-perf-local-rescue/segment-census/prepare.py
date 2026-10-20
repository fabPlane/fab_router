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
replacements = [('import type { Barrel, Fence, Layout, Pad, Pour, Rim, Track }', 'import { dist2PtSeg, segsIntersect } from "../geom/index.ts";\nimport type { Barrel, Fence, Layout, Pad, Pour, Rim, Track }'), ('  return orTouching ? d2 <= need * need : d2 < need * need;', '  if (ca.pts.length === 2 && cb.pts.length === 2) {\n    const meter = ((globalThis as any).__segmentCensus ??= {});\n    const threshold = need * need;\n    const accept = (v: number) => orTouching ? v <= threshold : v < threshold;\n    const [a1,a2] = ca.pts as [Pt,Pt], [b1,b2] = cb.pts as [Pt,Pt];\n    let stage = "none";\n    if (segsIntersect(a1,a2,b1,b2)) stage = accept(0) ? "intersection" : "intersection-reject";\n    else {\n      const distances = [dist2PtSeg(a1,b1,b2),dist2PtSeg(a2,b1,b2),dist2PtSeg(b1,a1,a2),dist2PtSeg(b2,a1,a2)];\n      const index = distances.findIndex(accept);\n      if (index >= 0) stage = String(index+1);\n    }\n    const result = accept(d2);\n    if (result !== (stage !== "none" && stage !== "intersection-reject")) throw Error("threshold observer mismatch");\n    const key = a.kind+":"+b.kind+":"+(orTouching?"touch":"spacing")+":"+stage;\n    meter[key] = (meter[key] ?? 0)+1;\n  }\n  return orTouching ? d2 <= need * need : d2 < need * need;')]
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
