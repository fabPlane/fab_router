/**
 * Exact oracle: an independent bigint re-implementation of `orient`, `segsIntersect` and the
 * squared distances, fuzzed against the float64 kernel with coordinates up to ±2^25 (values that
 * hug the bound, near-collinear triples, shared endpoints, collinear overlaps). Deterministic
 * seeded generator so a failure is reproducible.
 */
import { describe, expect, test } from "bun:test";
import {
  MAX_COORD, area2, dist2PtPt, dist2PtSeg, dist2SegSeg, hullOf, isConvexCcw, onSeg, orient, pointInConvex,
  pointInRing, segsIntersect, type Pt,
} from "../src/geom/index.ts";

// ---- oracle -----------------------------------------------------------------------------------
const B = BigInt;
function crossB(a: Pt, b: Pt, c: Pt): bigint {
  return (B(b.x) - B(a.x)) * (B(c.y) - B(a.y)) - (B(b.y) - B(a.y)) * (B(c.x) - B(a.x));
}
function orientB(a: Pt, b: Pt, c: Pt): -1 | 0 | 1 {
  const v = crossB(a, b, c);
  return v > 0n ? 1 : v < 0n ? -1 : 0;
}
function onSegB(p: Pt, a: Pt, b: Pt): boolean {
  if (crossB(a, b, p) !== 0n) return false;
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}
function segsIntersectB(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const o1 = orientB(p1, p2, q1), o2 = orientB(p1, p2, q2), o3 = orientB(q1, q2, p1), o4 = orientB(q1, q2, p2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return (o1 === 0 && onSegB(q1, p1, p2)) || (o2 === 0 && onSegB(q2, p1, p2)) ||
    (o3 === 0 && onSegB(p1, q1, q2)) || (o4 === 0 && onSegB(p2, q1, q2));
}
/** Exact squared point–segment distance as {num, den} plus whether an endpoint is nearest. */
function dist2PtSegB(p: Pt, a: Pt, b: Pt): { num: bigint; den: bigint; endpoint: boolean } {
  const dx = B(b.x) - B(a.x), dy = B(b.y) - B(a.y);
  const len2 = dx * dx + dy * dy;
  const px = B(p.x) - B(a.x), py = B(p.y) - B(a.y);
  const t = px * dx + py * dy;
  if (len2 === 0n || t <= 0n) return { num: px * px + py * py, den: 1n, endpoint: true };
  if (t >= len2) { const qx = B(p.x) - B(b.x), qy = B(p.y) - B(b.y); return { num: qx * qx + qy * qy, den: 1n, endpoint: true }; }
  const c = dx * py - dy * px;
  return { num: c * c, den: len2, endpoint: false };
}
function toNumber(f: { num: bigint; den: bigint }): number {
  return Number(f.num) / Number(f.den);
}

// ---- generator ---------------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x5eed);
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
function coord(): number {
  const r = rnd();
  if (r < 0.15) return int(-100, 100);
  if (r < 0.25) return int(-100000, 100000);
  if (r < 0.35) return rnd() < 0.5 ? MAX_COORD - int(0, 64) : -MAX_COORD + int(0, 64);
  return int(-MAX_COORD, MAX_COORD);
}
const P = (): Pt => ({ x: coord(), y: coord() });
/** A point near the line a→b: an exact lattice point on it, nudged by 0..2 units. */
function nearLine(a: Pt, b: Pt): Pt {
  const t = rnd();
  const x = Math.round(a.x + t * (b.x - a.x)), y = Math.round(a.y + t * (b.y - a.y));
  const nudge = () => int(-2, 2);
  const p = { x: x + nudge(), y: y + nudge() };
  p.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, p.x));
  p.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, p.y));
  return p;
}
function nearCollinearTriple(): [Pt, Pt, Pt] {
  const a = P(), b = P();
  return [a, b, nearLine(a, b)];
}
function exactCollinearTriple(): [Pt, Pt, Pt] {
  // c = a + k·(b − a)/g for integer k so that c is an exact lattice point on the line.
  const a = P(), b = P();
  const dx = b.x - a.x, dy = b.y - a.y;
  const g = gcd(Math.abs(dx), Math.abs(dy)) || 1;
  const k = int(-3, 3);
  const c = { x: a.x + (dx / g) * k, y: a.y + (dy / g) * k };
  c.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, c.x));
  c.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, c.y));
  return [a, b, c];
}
function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }

const N = 100_000;

describe("float64 kernel vs bigint oracle", () => {
  test(`orient agrees on ${N} triples (random, near-collinear, exactly collinear)`, () => {
    for (let i = 0; i < N; i++) {
      const k = i % 3;
      const [a, b, c] = k === 0 ? [P(), P(), P()] : k === 1 ? nearCollinearTriple() : exactCollinearTriple();
      const got = orient(a, b, c), want = orientB(a, b, c);
      if (got !== want) throw new Error(`orient mismatch at ${i}: ${JSON.stringify([a, b, c])} got ${got} want ${want}`);
      const os = onSeg(c, a, b), osB = onSegB(c, a, b);
      if (os !== osB) throw new Error(`onSeg mismatch at ${i}: ${JSON.stringify([a, b, c])}`);
    }
  });

  test(`segsIntersect agrees on ${N} segment pairs`, () => {
    let hits = 0;
    for (let i = 0; i < N; i++) {
      const p1 = P(), p2 = P();
      let q1: Pt, q2: Pt;
      switch (i % 5) {
        case 0: q1 = P(); q2 = P(); break;
        case 1: q1 = nearLine(p1, p2); q2 = P(); break;                 // touch / near-touch
        case 2: q1 = nearLine(p1, p2); q2 = nearLine(p1, p2); break;     // near-collinear overlap
        case 3: q1 = p2; q2 = P(); break;                                // shared endpoint
        default: { const [a, b, c] = exactCollinearTriple(); q1 = c; q2 = { x: a.x, y: a.y }; p1.x = a.x; p1.y = a.y; p2.x = b.x; p2.y = b.y; }
      }
      const got = segsIntersect(p1, p2, q1, q2), want = segsIntersectB(p1, p2, q1, q2);
      if (got !== want) throw new Error(`segsIntersect mismatch at ${i}: ${JSON.stringify([p1, p2, q1, q2])} got ${got} want ${want}`);
      if (want) hits++;
    }
    expect(hits).toBeGreaterThan(N / 10);
  });

  test(`squared distances agree on ${N} cases (exact when an endpoint is nearest)`, () => {
    for (let i = 0; i < N; i++) {
      const a = P(), b = P();
      const p = i % 2 === 0 ? P() : nearLine(a, b);
      const want = dist2PtSegB(p, a, b);
      const got = dist2PtSeg(p, a, b);
      if (want.endpoint) {
        if (got !== Number(want.num)) throw new Error(`endpoint dist2 mismatch at ${i}: ${JSON.stringify([p, a, b])} got ${got} want ${want.num}`);
      } else {
        const w = toNumber(want);
        const tol = Math.max(4e-15 * w, 1e-6);
        if (Math.abs(got - w) > tol) throw new Error(`interior dist2 mismatch at ${i}: ${JSON.stringify([p, a, b])} got ${got} want ${w}`);
      }
      // point–point is always exact
      expect(dist2PtPt(a, b)).toBe(Number((B(b.x) - B(a.x)) ** 2n + (B(b.y) - B(a.y)) ** 2n));
      // segment–segment: zero iff the oracle says they intersect; otherwise the min of the four.
      if (i % 4 === 0) {
        const c = P(), d = nearLine(a, b);
        const ss = dist2SegSeg(a, b, c, d);
        const inter = segsIntersectB(a, b, c, d);
        if (inter !== (ss === 0)) throw new Error(`dist2SegSeg zero-ness mismatch at ${i}: ${JSON.stringify([a, b, c, d])}`);
      }
    }
  });

  test("hull, convex containment and ring containment agree with the oracle on 2 000 random sets", () => {
    for (let i = 0; i < 2000; i++) {
      const n = int(3, 12);
      const pts: Pt[] = [];
      for (let k = 0; k < n; k++) pts.push(P());
      const hull = hullOf(pts);
      if (hull.length >= 3) {
        expect(isConvexCcw(hull)).toBe(true);
        expect(area2(hull) > 0).toBe(true);
        for (const p of pts) {
          // every input point is inside or on the hull, by exact orientation
          for (let e = 0; e < hull.length; e++) {
            const o = orientB(hull[e]!, hull[(e + 1) % hull.length]!, p);
            expect(o >= 0).toBe(true);
          }
          expect(pointInConvex(hull, p)).not.toBe("outside");
          expect(pointInRing(hull, p)).not.toBe("outside");
        }
        // a hull vertex is on the boundary
        expect(pointInConvex(hull, hull[0]!)).toBe("boundary");
        expect(pointInRing(hull, hull[0]!)).toBe("boundary");
      }
    }
  });
});
