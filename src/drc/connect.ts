/**
 * Connectivity (docs/DESIGN.md §5; spec/rules/connectivity.md K-01 … K-12).
 *
 * Joins: two same-net items are directly connected when their copper overlaps or touches on a
 * Sheet (K-01), through a Barrel's or through Pad's whole span (K-02, an item is one thing), or
 * when copper overlaps a Pour's filled area (K-03, K-04). Candidates come from the Lattice
 * (bounds on the Sheet, no expansion), the decision from the exact tests of exact.ts / pour.ts.
 * Components are the equivalence classes of the join relation under union-find with path
 * compression and union by size (Tarjan 1975); only components holding a Pad or a Pour are
 * terminal (K-08). `requiredConnectionsOf` is Kruskal's (1956) minimum spanning tree over the
 * terminal components of a net, edge weight = the smallest Euclidean distance between a Pad
 * centre / Barrel centre / Pour vertex of one and of the other, ties broken by the lower item
 * id pair (K-11; docs/DESIGN.md §5).
 *
 * Public surface: ItemCat, ConnItem, NetComponents, Connectivity, connectivity,
 * requiredConnectionsOf, incompleteCount.
 */
import type { Barrel, Layout, Pad, Pour, Pt, Track } from "../../spec/types/layout.ts";
import type { Connection } from "../../spec/types/results.ts";
import type { Box, Shape } from "../geom/index.ts";
import { boxOfPts, dist2PtPt } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import { barrelSheets, boundsOfShapes } from "../lattice/index.ts";
import { anyTouching } from "./exact.ts";
import { pourRegion, poursTouch, shapeTouchesPour, type PourRegion } from "./pour.ts";

export type ItemCat = "pad" | "barrel" | "track" | "pour";
export interface ConnItem { id: number; cat: ItemCat; net: number; ref: Pad | Barrel | Track | Pour }

export interface NetComponents {
  net: number;
  /** Every component of the net as ascending item ids, ordered by their first id. */
  components: number[][];
  /** Indices into `components` of the terminal components (holding a Pad or a Pour), ascending. */
  terminal: number[];
}

export interface Connectivity {
  /** Per net id (index = net id; nets without items still get an entry). */
  nets: NetComponents[];
  /** Direct joins as unordered pairs of item ids (a < b), ascending. */
  joins: Array<[number, number]>;
  /** Every item with a net, by id. */
  items: Map<number, ConnItem>;
  /** Component index (within its net) of an item. */
  componentOf: Map<number, number>;
  /** The direct neighbours of an item under the join relation. */
  neighbours(id: number): readonly number[];
}

// ---- union-find (Tarjan 1975) ---------------------------------------------------------------

class UnionFind {
  private parent = new Map<number, number>();
  private size = new Map<number, number>();
  add(x: number): void { if (!this.parent.has(x)) { this.parent.set(x, x); this.size.set(x, 1); } }
  find(x: number): number {
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    while (this.parent.get(x) !== r) { const next = this.parent.get(x)!; this.parent.set(x, r); x = next; }
    return r;
  }
  union(a: number, b: number): void {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.size.get(ra)! < this.size.get(rb)!) { const t = ra; ra = rb; rb = t; }
    this.parent.set(rb, ra);
    this.size.set(ra, this.size.get(ra)! + this.size.get(rb)!);
  }
}

const pairKey = (a: number, b: number): number => Math.min(a, b) * 4294967296 + Math.max(a, b);

/** Compute the join relation and the components of every net. */
export function connectivity(layout: Layout, lattice: Lattice): Connectivity {
  const items = new Map<number, ConnItem>();
  const byNet = new Map<number, ConnItem[]>();
  const add = (cat: ItemCat, ref: Pad | Barrel | Track | Pour) => {
    if (ref.net === null) return;
    const it: ConnItem = { id: ref.id, cat, net: ref.net, ref };
    items.set(ref.id, it);
    const list = byNet.get(ref.net) ?? [];
    list.push(it);
    byNet.set(ref.net, list);
  };
  for (const p of layout.pads) add("pad", p);
  for (const b of layout.barrels) add("barrel", b);
  for (const t of layout.tracks) add("track", t);
  for (const p of layout.pours) add("pour", p);

  const regions = new Map<number, PourRegion>();
  const regionOf = (p: Pour): PourRegion => {
    let r = regions.get(p.id);
    if (!r) { r = pourRegion(p); regions.set(p.id, r); }
    return r;
  };

  const joined = new Set<number>();
  const joins: Array<[number, number]> = [];
  const adjacency = new Map<number, number[]>();
  const join = (a: number, b: number) => {
    const key = pairKey(a, b);
    if (joined.has(key)) return;
    joined.add(key);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    joins.push([lo, hi]);
    (adjacency.get(lo) ?? adjacency.set(lo, []).get(lo)!).push(hi);
    (adjacency.get(hi) ?? adjacency.set(hi, []).get(hi)!).push(lo);
  };

  const sheetsOf = (it: ConnItem): number[] => {
    switch (it.cat) {
      case "pad": return (it.ref as Pad).sheets.slice();
      case "barrel": return barrelSheets(layout, it.ref as Barrel);
      case "track": return (it.ref as Track).pts.length > 0 ? [(it.ref as Track).sheet] : [];
      case "pour": return (it.ref as Pour).outline.length >= 3 ? [(it.ref as Pour).sheet] : [];
    }
  };

  /** All copper of a non-Pour item on a Sheet (every Track leg). */
  const copperOn = (it: ConnItem, sheet: number): readonly Shape[] => {
    if (it.cat !== "track") return lattice.shapesOf(it.id, sheet);
    const t = it.ref as Track;
    const n = Math.max(1, t.pts.length - 1);
    const out: Shape[] = [];
    for (let leg = 0; leg < n; leg++) out.push(...lattice.shapesOf(it.id, sheet, leg));
    return out;
  };

  /** Query units of an item on a Sheet: one per Track leg, one otherwise. */
  const unitsOf = (it: ConnItem, sheet: number): Array<{ shapes: readonly Shape[]; bounds: Box }> => {
    if (it.cat === "pour") {
      const p = it.ref as Pour;
      return [{ shapes: [], bounds: boxOfPts(p.outline) }];
    }
    if (it.cat === "track") {
      const t = it.ref as Track;
      const n = Math.max(1, t.pts.length - 1);
      const out: Array<{ shapes: readonly Shape[]; bounds: Box }> = [];
      for (let leg = 0; leg < n; leg++) {
        const shapes = lattice.shapesOf(it.id, sheet, leg);
        const bounds = boundsOfShapes(shapes);
        if (bounds) out.push({ shapes, bounds });
      }
      return out;
    }
    const shapes = lattice.shapesOf(it.id, sheet);
    const bounds = boundsOfShapes(shapes);
    return bounds ? [{ shapes, bounds }] : [];
  };

  for (const it of items.values()) {
    for (const sheet of sheetsOf(it)) {
      for (const unit of unitsOf(it, sheet)) {
        const hits = lattice.hits(sheet, unit.bounds, (ref) => ref.id !== it.id);
        let lastId = -1;
        for (const hit of hits) {
          if (hit.id === lastId) continue;
          lastId = hit.id;
          const other = items.get(hit.id);
          if (!other || other.net !== it.net) continue;
          if (joined.has(pairKey(it.id, other.id))) continue;
          if (it.cat === "pour" || other.cat === "pour") {
            if (it.cat === "pour" && other.cat === "pour") {
              if (it.id > other.id) continue; // Pour–Pour once, from the lower id
              if (poursTouch(regionOf(it.ref as Pour), regionOf(other.ref as Pour))) join(it.id, other.id);
            } else if (it.cat !== "pour") {
              // Pour joins are tested from the non-Pour side.
              const region = regionOf(other.ref as Pour);
              if (unit.shapes.some((s) => shapeTouchesPour(s, region))) join(it.id, other.id);
            }
            continue;
          }
          if (it.id > other.id) continue; // each copper pair once, from the lower id
          if (anyTouching(unit.shapes, copperOn(other, sheet))) join(it.id, other.id);
        }
      }
    }
  }

  // Components per net.
  const nets: NetComponents[] = [];
  const componentOf = new Map<number, number>();
  for (const net of layout.nets) {
    const list = (byNet.get(net.id) ?? []).slice().sort((a, b) => a.id - b.id);
    const uf = new UnionFind();
    for (const it of list) uf.add(it.id);
    for (const it of list) for (const nb of adjacency.get(it.id) ?? []) if (items.get(nb)?.net === net.id) uf.union(it.id, nb);
    const groups = new Map<number, number[]>();
    for (const it of list) {
      const r = uf.find(it.id);
      const g = groups.get(r) ?? [];
      g.push(it.id);
      groups.set(r, g);
    }
    const components = [...groups.values()].sort((a, b) => a[0]! - b[0]!);
    const terminal: number[] = [];
    components.forEach((c, i) => {
      for (const id of c) componentOf.set(id, i);
      if (c.some((id) => { const cat = items.get(id)!.cat; return cat === "pad" || cat === "pour"; })) terminal.push(i);
    });
    nets[net.id] = { net: net.id, components, terminal };
  }
  joins.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { nets, joins, items, componentOf, neighbours: (id) => adjacency.get(id) ?? [] };
}

/** Anchor points of an item for K-11 distances: Pad / Barrel centre, Pour vertices; Tracks none. */
function anchorsOf(it: ConnItem): readonly Pt[] {
  switch (it.cat) {
    case "pad": return [(it.ref as Pad).at];
    case "barrel": return [(it.ref as Barrel).at];
    case "pour": return (it.ref as Pour).outline;
    case "track": return [];
  }
}

/** The required connections of one net: Kruskal over its terminal components (K-11). */
export function requiredConnectionsOf(conn: Connectivity, netId: number): Connection[] {
  const nc = conn.nets[netId];
  if (!nc || nc.terminal.length < 2) return [];
  interface Anchor { p: Pt; id: number }
  const comps: Anchor[][] = nc.terminal.map((ci) => {
    const anchors: Anchor[] = [];
    for (const id of nc.components[ci]!) {
      const it = conn.items.get(id);
      if (it) for (const p of anchorsOf(it)) anchors.push({ p, id });
    }
    return anchors;
  });
  interface Edge { d2: number; idA: number; idB: number; a: number; b: number }
  const edges: Edge[] = [];
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      let best: Edge | undefined;
      for (const x of comps[i]!) {
        for (const y of comps[j]!) {
          const d2 = dist2PtPt(x.p, y.p);
          if (best && d2 > best.d2) continue;
          const idA = Math.min(x.id, y.id), idB = Math.max(x.id, y.id);
          if (!best || d2 < best.d2 || idA < best.idA || (idA === best.idA && idB < best.idB)) best = { d2, idA, idB, a: i, b: j };
        }
      }
      if (best) edges.push(best);
    }
  }
  edges.sort((x, y) => x.d2 - y.d2 || x.idA - y.idA || x.idB - y.idB);
  const uf = new UnionFind();
  comps.forEach((_, i) => uf.add(i));
  const out: Connection[] = [];
  for (const e of edges) {
    if (uf.find(e.a) === uf.find(e.b)) continue;
    uf.union(e.a, e.b);
    out.push({ net: netId, from: e.idA, to: e.idB, airlineLu: Math.sqrt(e.d2) });
    if (out.length === comps.length - 1) break;
  }
  return out;
}

/** K-09: terminal components − 1 for a net (0 when fewer than two). */
export function incompleteCount(conn: Connectivity, netId: number): number {
  const nc = conn.nets[netId];
  return nc ? Math.max(0, nc.terminal.length - 1) : 0;
}
