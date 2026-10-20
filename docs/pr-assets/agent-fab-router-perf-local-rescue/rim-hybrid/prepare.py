from pathlib import Path
import sys
w=Path(sys.argv[1])/'candidate'
p=w/'src/geom/predicates.ts'
s=p.read_text();s+='''

/** Snapshot a ring into closed-y bins; edge order and exact predicates are retained. */
export function prepareRing(pts: readonly Pt[]): (p: Pt) => Containment {
  const ring = pts.map(p => ({...p}));
  if (ring.length < 16) return p => pointInRing(ring, p);
  let low = Infinity, high = -Infinity;
  for (const p of ring) { low = Math.min(low, p.y); high = Math.max(high, p.y); }
  if (!Number.isFinite(low) || !Number.isFinite(high) || high === low) return p => pointInRing(ring, p);
  const n = Math.min(128, Math.ceil(Math.sqrt(ring.length)));
  const bins: number[][] = Array.from({length: n}, () => []);
  const bin = (y: number) => Math.max(0, Math.min(n - 1, Math.floor((y - low) / (high - low) * n)));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + ring.length - 1) % ring.length]!, b = ring[i]!;
    for (let k = bin(Math.min(a.y, b.y)); k <= bin(Math.max(a.y, b.y)); k++) bins[k]!.push(i);
  }
  return p => {
    if (!Number.isFinite(p.y)) return pointInRing(ring, p);
    if (p.y < low || p.y > high) return "outside";
    let inside = false;
    for (const i of bins[bin(p.y)]!) {
      const a = ring[(i + ring.length - 1) % ring.length]!, b = ring[i]!;
      if ((p.y < a.y && p.y < b.y) || (p.y > a.y && p.y > b.y)) continue;
      const area = cross(a, b, p);
      if (area === 0 && Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x)) return "boundary";
      if ((a.y > p.y) !== (b.y > p.y)) {
        if (b.y > a.y ? area > 0 : area < 0) inside = !inside;
      }
    }
    return inside ? "inside" : "outside";
  };
}
''';p.write_text(s)
p=w/'src/geom/onboard.ts';s=p.read_text().replace('orient, pointInConvex, pointInRing','orient, pointInConvex, pointInRing, prepareRing')
s+='''

/** An immutable rim snapshot, owned and refreshed by the lattice item lifecycle. */
export function prepareRim(rim: Rim): (shapes: readonly Shape[]) => boolean {
  const outer = rim.outline.length >= 3 ? prepareRing(rim.outline) : undefined;
  const holes = rim.cutouts.filter(c => c.length >= 3).map(prepareRing);
  function partOK(part: ConvexShape): boolean {
    const core = coreOf(part);
    const count = core.r > 0 ? Math.min(1, core.pts.length) : core.pts.length;
    for (let i = 0; i < count; i++) {
      const p = core.pts[i]!;
      if (outer && outer(p) === "outside") return false;
      for (const hole of holes) if (hole(p) === "inside") return false;
    }
    return true;
  }
  return shapes => {
    for (const s of shapes) {
      if (s.kind === "pieces") { for (const p of s.parts) if (!partOK(p)) return false; }
      else if (!partOK(s)) return false;
    }
    return true;
  };
}
''';p.write_text(s)
p=w/'src/lattice/grid.ts';s=p.read_text().replace('dop8OfPts, dop8Union }','dop8OfPts, dop8Union, prepareRim, withinRim }')
s=s.replace('export interface Lattice {','export interface Lattice {\n  rimContains?: ((rim: Rim, shapes: readonly Shape[]) => boolean) | undefined;')
s=s.replace('  function insertItem(cat:', '  let preparedRim: {rim: Rim; contains: (shapes: readonly Shape[]) => boolean} | undefined;\n  const containsRim = (rim: Rim, shapes: readonly Shape[]) => preparedRim?.rim === rim ? preparedRim.contains(shapes) : withinRim(rim, shapes);\n\n  function insertItem(cat:')
s=s.replace('    directory.set(id, { cat, item, cache: new Map() });','    directory.set(id, { cat, item, cache: new Map() });\n    if (cat === "rim") { const rim = item as Rim; preparedRim = rim.outline.length + rim.cutouts.reduce((n, c) => n + c.length, 0) >= 64 ? {rim, contains: prepareRim(rim)} : undefined; }')
s=s.replace('  function removeItem(id: number): void {','  function removeItem(id: number): void {\n    if (id === RIM_ID) preparedRim = undefined;')
s=s.replace('    shapesOf,','    get rimContains() { return preparedRim ? containsRim : undefined; },\n    shapesOf,');p.write_text(s)
p=w/'src/route/clear.ts';s=p.read_text().replace('!withinRim(layout.rim, subject.shapes)','!(lattice.rimContains ? lattice.rimContains(layout.rim, subject.shapes) : withinRim(layout.rim, subject.shapes))').replace('!withinRim(layout.rim, copper)','!(lattice.rimContains ? lattice.rimContains(layout.rim, copper) : withinRim(layout.rim, copper))');p.write_text(s)
