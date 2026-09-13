/**
 * Convex decomposition of a simple polygon.
 *
 * Literature: ear clipping (Meisters 1975, "Polygons have ears": every simple polygon with more
 * than three vertices has at least two ears, so repeatedly cutting an ear triangulates it) followed
 * by Hertel & Mehlhorn (1983), "Fast triangulation of simple polygons": remove every triangulation
 * diagonal whose removal leaves both incident vertices convex — the result has at most four times
 * the optimal number of convex pieces. All turn and containment tests are exact predicates.
 *
 * Public surface: cleanRing, convexPieces.
 */
import type { Hull, Pt } from "./types.ts";
import { onSeg, orient, pointInConvex } from "./predicates.ts";
import { area2, hullOf, isConvexCcw } from "./hull.ts";

/**
 * Remove consecutive duplicates and collinear interior vertices, and orient counter-clockwise.
 * Returns fewer than three points for a degenerate ring.
 */
export function cleanRing(pts: readonly Pt[]): Pt[] {
  let ring: Pt[] = [];
  for (const p of pts) {
    const last = ring[ring.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) ring.push({ x: p.x, y: p.y });
  }
  while (ring.length > 1) {
    const a = ring[0]!, b = ring[ring.length - 1]!;
    if (a.x === b.x && a.y === b.y) ring.pop(); else break;
  }
  // Drop collinear vertices until stable.
  let changed = true;
  while (changed && ring.length >= 3) {
    changed = false;
    const out: Pt[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[(i + n - 1) % n]!, b = ring[i]!, c = ring[(i + 1) % n]!;
      if (orient(a, b, c) === 0 && onSeg(b, a, c)) { changed = true; continue; }
      out.push(b);
    }
    ring = out;
  }
  if (ring.length >= 3 && area2(ring) < 0) ring.reverse();
  return ring;
}

/** Decompose a simple polygon (either winding) into CCW convex Hulls whose union is the polygon. */
export function convexPieces(pts: readonly Pt[]): Hull[] {
  const ring = cleanRing(pts);
  if (ring.length < 3) return ring.length === 0 ? [] : [{ kind: "hull", pts: hullOf(ring) }];
  if (isConvexCcw(ring)) return [{ kind: "hull", pts: ring }];
  const tris = earClip(ring);
  if (tris === null) return [{ kind: "hull", pts: hullOf(ring) }]; // non-simple input: conservative
  return mergeTriangles(ring, tris).map((idx) => ({ kind: "hull" as const, pts: idx.map((i) => ring[i]!) }));
}

/** Ear clipping over vertex indices; returns null when no ear can be found (non-simple input). */
function earClip(ring: readonly Pt[]): number[][] | null {
  const n = ring.length;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(i);
  const tris: number[][] = [];
  // Only reflex vertices can block an ear; track them and refresh the two neighbours of each cut.
  const turn = (k: number): number => {
    const m = idx.length;
    return orient(ring[idx[(k + m - 1) % m]!]!, ring[idx[k]!]!, ring[idx[(k + 1) % m]!]!);
  };
  const reflex = new Set<number>();
  for (let k = 0; k < idx.length; k++) if (turn(k) < 0) reflex.add(idx[k]!);
  let start = 0;
  while (idx.length > 3) {
    let cut = false;
    const m = idx.length;
    for (let step = 0; step < m; step++) {
      const k = (start + step) % m;
      const ia = idx[(k + m - 1) % m]!, ib = idx[k]!, ic = idx[(k + 1) % m]!;
      const a = ring[ia]!, b = ring[ib]!, c = ring[ic]!;
      const o = orient(a, b, c);
      if (o < 0) continue; // reflex
      if (o > 0) {
        let blocked = false;
        for (const j of reflex) {
          if (j === ia || j === ib || j === ic) continue;
          if (pointInConvex([a, b, c], ring[j]!) !== "outside") { blocked = true; break; }
        }
        if (blocked) continue;
        tris.push([ia, ib, ic]);
      }
      // o === 0: a degenerate triangle contributes nothing; just drop the middle vertex.
      idx.splice(k, 1);
      reflex.delete(ib);
      const m2 = idx.length;
      const kp = (k + m2 - 1) % m2, kn = k % m2;
      for (const kk of [kp, kn]) { if (turn(kk) < 0) reflex.add(idx[kk]!); else reflex.delete(idx[kk]!); }
      start = kp;
      cut = true;
      break;
    }
    if (!cut) return null;
  }
  if (idx.length === 3 && orient(ring[idx[0]!]!, ring[idx[1]!]!, ring[idx[2]!]!) > 0) tris.push([idx[0]!, idx[1]!, idx[2]!]);
  return tris;
}

/** Hertel–Mehlhorn: merge triangles across diagonals while the union stays convex. */
function mergeTriangles(ring: readonly Pt[], tris: number[][]): number[][] {
  const pieces: (number[] | null)[] = tris.map((t) => t.slice());
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  // diagonal → pieces sharing it (only diagonals, not ring edges)
  const n = ring.length;
  const isEdge = (a: number, b: number) => (a + 1) % n === b || (b + 1) % n === a;
  const byDiag = new Map<string, number[]>();
  pieces.forEach((p, pi) => {
    if (!p) return;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!, b = p[(i + 1) % p.length]!;
      if (isEdge(a, b)) continue;
      const k = key(a, b);
      const list = byDiag.get(k) ?? [];
      list.push(pi);
      byDiag.set(k, list);
    }
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, owners] of [...byDiag.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (owners.length !== 2) continue;
      const [pa, pb] = owners as [number, number];
      const A = pieces[pa], Bp = pieces[pb];
      if (!A || !Bp) continue;
      const [u, v] = k.split(":").map(Number) as [number, number];
      const merged = mergeAcross(A, Bp, u, v);
      if (!merged || !isConvexCcw(merged.map((i) => ring[i]!))) continue;
      pieces[pa] = merged;
      pieces[pb] = null;
      byDiag.delete(k);
      for (const [k2, o2] of byDiag) {
        const r = o2.map((x) => (x === pb ? pa : x));
        byDiag.set(k2, r);
      }
      changed = true;
      break;
    }
  }
  return pieces.filter((p): p is number[] => p !== null);
}

/** Join two CCW index rings sharing the diagonal u–v into one ring without that diagonal. */
function mergeAcross(A: number[], B: number[], u: number, v: number): number[] | null {
  const ia = A.indexOf(u), ib = B.indexOf(u);
  if (ia < 0 || ib < 0) return null;
  // In A, walk from u around to v; in B walk from v around to u (both CCW), then concatenate.
  const walk = (ring: number[], from: number, to: number): number[] | null => {
    const out: number[] = [];
    let i = ring.indexOf(from);
    if (i < 0) return null;
    for (let s = 0; s < ring.length; s++) {
      const x = ring[(i + s) % ring.length]!;
      out.push(x);
      if (x === to) return out;
    }
    return null;
  };
  // Determine orientation: A contains u→v as consecutive (u then v) or v then u.
  const nextA = A[(ia + 1) % A.length];
  const first = nextA === v ? walk(A, v, u) : walk(A, u, v);
  const second = nextA === v ? walk(B, u, v) : walk(B, v, u);
  if (!first || !second) return null;
  // first ends where second starts; second ends where first starts.
  return first.slice(0, -1).concat(second.slice(0, -1));
}
