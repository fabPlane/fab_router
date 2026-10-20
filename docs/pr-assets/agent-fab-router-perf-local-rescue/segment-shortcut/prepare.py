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
p=out/'candidate/src/route/clear.ts';s=p.read_text()
s=s.replace('import type { Barrel, Fence, Layout, Pad, Pour, Rim, Track }','import { dist2PtSeg, segsIntersect } from "../geom/index.ts";\nimport type { Barrel, Fence, Layout, Pad, Pour, Rim, Track }',1)
old='  const d2 = dist2Pts(ca.pts, cb.pts);'
new='''  if (ca.pts.length === 2 && cb.pts.length === 2) {
    const a = ca.pts[0]!, b = ca.pts[1]!, c = cb.pts[0]!, d = cb.pts[1]!;
    // Also rejects NaN and infinities without changing out-of-domain semantics.
    const valid = (p: Pt) => Math.abs(p.x) <= 2 ** 25 && Math.abs(p.y) <= 2 ** 25;
    if (valid(a) && valid(b) && valid(c) && valid(d)) {
      const threshold = need * need;
      const accept = (v: number) => orTouching ? v <= threshold : v < threshold;
      if (segsIntersect(a,b,c,d)) return accept(0);
      return accept(dist2PtSeg(a,c,d)) || accept(dist2PtSeg(b,c,d)) ||
        accept(dist2PtSeg(c,a,b)) || accept(dist2PtSeg(d,a,b));
    }
  }
  const d2 = dist2Pts(ca.pts, cb.pts);'''
assert s.count(old)==1;s=s.replace(old,new);p.write_text(s)
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=root).split(b'\0'):
    if not raw:continue
    rel=raw.decode();audit[rel]={k:hashlib.sha256((out/k/rel).read_bytes()).hexdigest() for k in ['original','candidate']}
assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/route/clear.ts']
(out/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'clear-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=root/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,arc in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/arc).read_bytes()))
