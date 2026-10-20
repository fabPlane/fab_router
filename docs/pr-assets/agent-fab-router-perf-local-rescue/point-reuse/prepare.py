from pathlib import Path
import sys
w=Path(sys.argv[1]);p=w/'candidate/src/route/search.ts';s=p.read_text()
s=s.replace('  pointOf(gx: number, gy: number): Pt;', '  /** Opt in only for pure pointOf and callbacks that never mutate or retain point identity. */\n  readonly reusePoints?: boolean;\n  pointOf(gx: number, gy: number): Pt;')
needle='  const cellIndex = (gx: number, gy: number): number => (gy - region.gy0) * width + (gx - region.gx0);'
cache='''
  // Search-owned bounded direct-mapped cache. Reconstruction still returns fresh callback points.
  const pointKeys = space.reusePoints ? new Float64Array(4096).fill(-1) : undefined;
  const pointValues: (Pt | undefined)[] = pointKeys ? new Array(4096) : [];
  const pointAt = (gx: number, gy: number): Pt => {
    if (!pointKeys) return space.pointOf(gx, gy);
    const key = cellIndex(gx, gy), slot = key & 4095;
    if (pointKeys[slot] === key) return pointValues[slot]!;
    const pt = space.pointOf(gx, gy);
    pointKeys[slot] = key; pointValues[slot] = pt;
    return pt;
  };
'''
assert s.count(needle)==2;s=s.replace(needle,needle+cache)
for old,new in [('const from = space.pointOf(cgx, cgy);','const from = pointAt(cgx, cgy);'),('const to = space.pointOf(ngx, ngy);','const to = pointAt(ngx, ngy);')]:
 assert s.count(old)==2;s=s.replace(old,new)
p.write_text(s)
p=w/'candidate/src/route/passes.ts';s=p.read_text();s=s.replace('step: region.step, pointOf: quilt.pointOf, nodeFree, edgeCost','reusePoints: true, step: region.step, pointOf: quilt.pointOf, nodeFree, edgeCost');s=s.replace('step: st, layers: usable.length, pointOf,','reusePoints: true, step: st, layers: usable.length, pointOf,');p.write_text(s)
