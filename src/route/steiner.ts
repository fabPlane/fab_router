/**
 * Steiner decomposition — per-net rectilinear decomposition of a net's terminals into 2-pin
 * Segments over the Mesh (docs/DESIGN.md §10.3). Literature: Chu & Wong (2008) FLUTE and
 * Hwang (1976) "On Steiner minimal trees with rectilinear distance" — the rectilinear Steiner
 * minimal tree these Segments approximate; Kruskal (1956) — the minimum spanning tree used as the
 * deterministic RSMT fallback (a rectilinear MST is a 2-approximation of the RSMT and, unlike a
 * FLUTE lookup, needs no table, so it is the correct-and-deterministic first cut the task calls
 * for). A FLUTE upgrade can replace `mstSegments` later behind the same `Segment[]` interface.
 *
 * This decomposition **supersedes** `requiredConnectionsOf`'s per-net MST *only when the global
 * plan is active*; it commits no copper — it is a proposal over the Mesh, so R-1 is untouched.
 *
 * A net's terminals are the representative points of its *terminal components* (a connected
 * component holding a Pad or a non-prior Pour — the same terminal notion `connect.ts` uses). Each
 * component is already internally connected, so one representative point (its lowest-item-id
 * anchor) stands in for the whole component. The rectilinear MST over those points, cut edge by
 * edge, is the Segment list.
 *
 * Public surface: steinerDecompose.
 */
import type { Barrel, Layout, Pad, Pour, Pt, Track } from "../../spec/types/layout.ts";
import { dist2PtPt } from "../geom/index.ts";
import { buildLattice, barrelSheets, type Lattice } from "../lattice/index.ts";
import { connectivity, type Connectivity } from "../drc/connect.ts";
import type { Mesh } from "./mesh.ts";
import type { Segment, Terminal } from "./plan.ts";

/** A net terminal before it is placed on the Mesh: a representative point plus its Sheets. */
interface RawTerminal { point: Pt; sheets: number[]; anchor: number }

/**
 * Decompose every net with two or more terminal components into 2-pin Segments over `mesh`.
 * `conn` may be supplied (the caller already built connectivity); otherwise it is built here so
 * the two-argument signature in the task is self-contained.
 */
export function steinerDecompose(layout: Layout, mesh: Mesh, conn?: Connectivity): Segment[] {
  let lattice: Lattice | undefined;
  const cn = conn ?? connectivity(layout, (lattice = buildLattice(layout)));
  const meshSheets = new Set(mesh.sheets);
  const usableOf = usableSheetsByNet(layout);

  const segments: Segment[] = [];
  let segId = 0;
  // Nets are indexed by id; iterate ascending for determinism.
  for (const net of layout.nets) {
    const nc = cn.nets[net.id];
    if (!nc || nc.terminal.length < 2) continue;

    const usable = usableOf.get(net.group);
    const raws: RawTerminal[] = [];
    for (const ci of nc.terminal) {
      const raw = representative(layout, cn, nc.components[ci]!, meshSheets, usable, mesh.sheets);
      if (raw) raws.push(raw);
    }
    if (raws.length < 2) continue;

    const terms = raws.map((r) => toTerminal(mesh, r));
    for (const [a, b] of rectilinearMst(terms)) {
      segments.push({
        id: segId++, net: net.id,
        from: terms[a]!, to: terms[b]!,
        airlineLu: Math.sqrt(dist2PtPt(terms[a]!.point, terms[b]!.point)),
      });
    }
  }
  return segments;
}

// ---- terminals ---------------------------------------------------------------------------------

/** Signal Sheet ids the group may use, intersected with the Mesh; `undefined` = every Mesh Sheet. */
function usableSheetsByNet(layout: Layout): Map<number, Set<number> | undefined> {
  const m = new Map<number, Set<number> | undefined>();
  for (const g of layout.netGroups) m.set(g.id, g.usableSheets ? new Set(g.usableSheets) : undefined);
  return m;
}

/** The representative point and attach-Sheets of one terminal component (lowest-id anchor). */
function representative(
  layout: Layout, conn: Connectivity, component: readonly number[],
  meshSheets: Set<number>, usable: Set<number> | undefined, allMeshSheets: readonly number[],
): RawTerminal | undefined {
  // Anchor = the component item with the lowest id that offers a representative point.
  let anchorId = -1;
  let point: Pt | undefined;
  const sheets = new Set<number>();
  for (const id of component) {
    const it = conn.items.get(id);
    if (!it) continue;
    const p = anchorPoint(layout, it.cat, it.ref);
    if (p && (anchorId < 0 || id < anchorId)) { anchorId = id; point = p; }
    for (const s of sheetsOfItem(layout, it.cat, it.ref)) if (meshSheets.has(s)) sheets.add(s);
  }
  if (!point) return undefined;
  let list = [...sheets];
  if (usable) list = list.filter((s) => usable.has(s));
  if (list.length === 0) list = usable ? allMeshSheets.filter((s) => usable.has(s)) : [...allMeshSheets];
  if (list.length === 0) list = [...allMeshSheets];
  list.sort((a, b) => a - b);
  return { point, sheets: list, anchor: anchorId };
}

function anchorPoint(_layout: Layout, cat: string, ref: Pad | Barrel | Track | Pour): Pt | undefined {
  switch (cat) {
    case "pad": return (ref as Pad).at;
    case "barrel": return (ref as Barrel).at;
    case "pour": { const o = (ref as Pour).outline; return o.length > 0 ? o[0] : undefined; }
    case "track": { const pts = (ref as Track).pts; return pts.length > 0 ? pts[0] : undefined; }
    default: return undefined;
  }
}

function sheetsOfItem(layout: Layout, cat: string, ref: Pad | Barrel | Track | Pour): readonly number[] {
  switch (cat) {
    case "pad": return (ref as Pad).sheets;
    case "barrel": return barrelSheets(layout, ref as Barrel);
    case "track": return [(ref as Track).sheet];
    case "pour": return [(ref as Pour).sheet];
    default: return [];
  }
}

/** Place a raw terminal on the Mesh: its Bin column and the terminal Bin id on each Sheet. */
function toTerminal(mesh: Mesh, raw: RawTerminal): Terminal {
  const seedSheet = raw.sheets[0]!;
  const colId = mesh.binOf(seedSheet, raw.point);
  const bin = mesh.binAt(colId);
  const bins: number[] = [];
  for (const s of raw.sheets) {
    const id = mesh.binId(s, bin.bx, bin.by);
    if (id >= 0) bins.push(id);
  }
  bins.sort((a, b) => a - b);
  return { point: raw.point, bx: bin.bx, by: bin.by, sheets: raw.sheets, bins, anchor: raw.anchor };
}

// ---- rectilinear MST (Kruskal) ------------------------------------------------------------------

/** Minimum spanning tree over terminals by rectilinear (Manhattan) distance; deterministic ties. */
function rectilinearMst(terms: readonly Terminal[]): Array<[number, number]> {
  const n = terms.length;
  interface E { d: number; idA: number; idB: number; a: number; b: number }
  const edges: E[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = terms[i]!, b = terms[j]!;
      const d = Math.abs(a.point.x - b.point.x) + Math.abs(a.point.y - b.point.y);
      const idA = Math.min(a.anchor, b.anchor), idB = Math.max(a.anchor, b.anchor);
      edges.push({ d, idA, idB, a: i, b: j });
    }
  }
  edges.sort((x, y) => x.d - y.d || x.idA - y.idA || x.idB - y.idB);
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]!]!; x = parent[x]!; } return x; };
  const out: Array<[number, number]> = [];
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra === rb) continue;
    parent[ra] = rb;
    out.push([e.a, e.b]);
    if (out.length === n - 1) break;
  }
  return out;
}
