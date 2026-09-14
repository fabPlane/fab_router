/**
 * Task I10 corner-stitched tile decomposition (docs/DESIGN.md §9b-2; Ousterhout 1984 corner
 * stitching, Dion & Monier 1995 gridless tiles). The tests check the decomposition against a
 * brute-force free-space membership test on random obstacle sets: every tile lies in the region and
 * is disjoint from the expanded obstacles and from the other tiles, and for interior sample points
 * `tileAt` is defined exactly where the point is clear centreline space. A fixed small case pins the
 * tile count and adjacency; the budget flag is exercised.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet } from "../spec/types/layout.ts";
import type { Box } from "../src/geom/index.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../spec/types/settings.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { resolveProfile } from "../src/route/profile.ts";
import { ignoreOf } from "../src/route/clear.ts";
import { buildTileField } from "../src/route/tiles.ts";

const LU = 10;
const PAD_HALF = 3000;   // obstacle pad copper half-extent (box)
const TRACK_WIDTH = 4000; // SIG width ⇒ halfWidth 2000
const SPACING = 2000;
const MARGIN = TRACK_WIDTH / 2 + SPACING; // expansion of each obstacle box

/** A one-Sheet board whose only obstacles are box Pads (net ≥ 1) at the given centres. */
function boxBoard(centres: Pt[]): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const kinds = ["", "default"];
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : SPACING));
  const padForms: PadForm[] = [
    { id: 100, name: "obs", perSheet: new Map([[0, [{ kind: "box", box: { x0: -PAD_HALF, y0: -PAD_HALF, x1: PAD_HALF, y1: PAD_HALF } }]]]), attachAllowed: false },
  ];
  const parts: Part[] = [{ id: 1, ref: "U1", package: "p", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }];
  const pads: Pad[] = [];
  const nets: Net[] = [{ id: 0, name: "SIG", group: 0, pads: [] }];
  let pid = 20;
  centres.forEach((c, i) => {
    const netId = 1 + i;
    pads.push({ id: pid++, part: 1, pinName: `O${i}`, net: netId, form: 100, at: c, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    nets.push({ id: netId, name: `OBS${i}`, group: 0, pads: [pid - 1] });
  });
  const netGroups: NetGroup[] = [
    { id: 0, name: "default", nets: nets.map((n) => n.id), trackWidth: TRACK_WIDTH, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
  ];
  const rim: Rim = { outline: [{ x: -200_000, y: -200_000 }, { x: 200_000, y: -200_000 }, { x: 200_000, y: 200_000 }, { x: -200_000, y: 200_000 }], cutouts: [], kind: 1 };
  return {
    name: "t", frame: { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU },
    angleMode: "any", stack, padForms, parts, pads, barrels: [], tracks: [], pours: [], fences: [], rim,
    nets, netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  };
}

const settings = { ...DEFAULT_ROUTE_SETTINGS };
const REGION: Box = { x0: -50_000, y0: -50_000, x1: 50_000, y1: 50_000 };

const expandedBox = (c: Pt): Box => ({ x0: c.x - PAD_HALF - MARGIN, y0: c.y - PAD_HALF - MARGIN, x1: c.x + PAD_HALF + MARGIN, y1: c.y + PAD_HALF + MARGIN });
const strictlyInside = (p: Pt, b: Box): boolean => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;
const inBoxIncl = (p: Pt, b: Box): boolean => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const interiorOverlap = (a: Box, b: Box): boolean => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

/** Deterministic LCG in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

describe("buildTileField decomposition", () => {
  test("tiles partition the free space and agree with a brute-force check on random obstacles", () => {
    const rnd = lcg(12345);
    for (let trial = 0; trial < 20; trial++) {
      const n = 3 + Math.floor(rnd() * 8);
      const centres: Pt[] = [];
      for (let i = 0; i < n; i++) {
        centres.push({ x: Math.round((rnd() * 2 - 1) * 40_000), y: Math.round((rnd() * 2 - 1) * 40_000) });
      }
      const L = boxBoard(centres);
      const lat = buildLattice(L);
      const profile = resolveProfile(L, 0, settings);
      const field = buildTileField(L, lat, 0, profile, REGION, { ignore: ignoreOf(0), maxTiles: 200_000 });
      expect(field.overBudget).toBe(false);
      const tiles = field.tiles();
      const boxes = centres.map(expandedBox);

      // Every tile is inside the region and disjoint (interiors) from every obstacle box.
      for (const t of tiles) {
        expect(t.box.x0 >= REGION.x0 && t.box.y0 >= REGION.y0 && t.box.x1 <= REGION.x1 && t.box.y1 <= REGION.y1).toBe(true);
        for (const b of boxes) expect(interiorOverlap(t.box, b)).toBe(false);
      }
      // Tiles do not overlap one another (interiors disjoint).
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
          expect(interiorOverlap(tiles[i]!.box, tiles[j]!.box)).toBe(false);
        }
      }
      // For interior sample points (kept clear of every edge), tileAt is defined exactly where free.
      const edges = new Set<number>([REGION.x0, REGION.x1, REGION.y0, REGION.y1]);
      for (const b of boxes) { edges.add(b.x0); edges.add(b.x1); edges.add(b.y0); edges.add(b.y1); }
      for (let s = 0; s < 200; s++) {
        const p = { x: Math.round((rnd() * 2 - 1) * 49_000), y: Math.round((rnd() * 2 - 1) * 49_000) };
        // Skip points within 2 LU of any relevant edge (measure-zero boundary ambiguity).
        let nearEdge = false;
        for (const e of edges) if (Math.abs(p.x - e) <= 2 || Math.abs(p.y - e) <= 2) { nearEdge = true; break; }
        if (nearEdge) continue;
        const brute = inBoxIncl(p, REGION) && !boxes.some((b) => strictlyInside(p, b));
        const tile = field.tileAt(p);
        expect(tile !== undefined).toBe(brute);
        if (tile) expect(inBoxIncl(p, tile.box)).toBe(true);
      }
    }
  });

  test("a single central obstacle yields four maximal tiles with the expected adjacency", () => {
    const L = boxBoard([{ x: 0, y: 0 }]);
    const lat = buildLattice(L);
    const profile = resolveProfile(L, 0, settings);
    const field = buildTileField(L, lat, 0, profile, REGION, { ignore: ignoreOf(0), maxTiles: 1000 });
    const tiles = field.tiles();
    expect(tiles.length).toBe(4); // below, left, right, above

    const below = tiles.find((t) => t.box.y1 === -(PAD_HALF + MARGIN) && t.box.x0 === REGION.x0 && t.box.x1 === REGION.x1)!;
    const above = tiles.find((t) => t.box.y0 === PAD_HALF + MARGIN && t.box.x0 === REGION.x0 && t.box.x1 === REGION.x1)!;
    const left = tiles.find((t) => t.box.x1 === -(PAD_HALF + MARGIN))!;
    const right = tiles.find((t) => t.box.x0 === PAD_HALF + MARGIN)!;
    expect(below && above && left && right).toBeTruthy();

    // Below is adjacent to both sides; each side is adjacent to above; below and above are not adjacent.
    expect(field.freeNeighbours(below.id)).toContain(left.id);
    expect(field.freeNeighbours(below.id)).toContain(right.id);
    expect(field.freeNeighbours(above.id)).toContain(left.id);
    expect(field.freeNeighbours(above.id)).not.toContain(below.id);

    const p = field.portal(below.id, left.id)!;
    expect(p).toBeDefined();
    expect(p.width).toBe(-(PAD_HALF + MARGIN) - REGION.x0);
    expect(p.at).toBe(-(PAD_HALF + MARGIN));
  });

  test("reports overBudget when the tile count exceeds the budget", () => {
    const L = boxBoard([{ x: -20_000, y: 0 }, { x: 20_000, y: 0 }]);
    const lat = buildLattice(L);
    const profile = resolveProfile(L, 0, settings);
    const field = buildTileField(L, lat, 0, profile, REGION, { ignore: ignoreOf(0), maxTiles: 1 });
    expect(field.overBudget).toBe(true);
  });
});
