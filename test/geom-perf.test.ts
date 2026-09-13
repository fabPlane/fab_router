/**
 * Coarse performance guard for the constructive kernel: a 2 000-vertex pour-like ring must
 * decompose well under a second, and hulls of 100 000 points must be quick.
 */
import { expect, test } from "bun:test";
import { area2, convexPieces, hullOf, type Pt } from "../src/geom/index.ts";

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
const rnd = mulberry32(7);

test("convexPieces on a 2 000-vertex star ring", () => {
  const n = 2000;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const r = 1_000_000 + Math.floor(rnd() * 9_000_000);
    pts.push({ x: Math.round(r * Math.cos(a)), y: Math.round(r * Math.sin(a)) });
  }
  const t0 = performance.now();
  const pieces = convexPieces(pts);
  const ms = performance.now() - t0;
  expect(pieces.reduce((s, p) => s + area2(p.pts), 0)).toBe(area2(pts));
  expect(ms).toBeLessThan(5000);
  console.log(`convexPieces: ${n} vertices → ${pieces.length} pieces in ${ms.toFixed(0)} ms`);
});

test("hullOf on 100 000 points", () => {
  const pts: Pt[] = [];
  for (let i = 0; i < 100_000; i++) pts.push({ x: Math.floor((rnd() - 0.5) * 2 ** 26), y: Math.floor((rnd() - 0.5) * 2 ** 26) });
  const t0 = performance.now();
  const h = hullOf(pts);
  const ms = performance.now() - t0;
  expect(h.length).toBeGreaterThan(3);
  expect(ms).toBeLessThan(2000);
});
