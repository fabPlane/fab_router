/**
 * Layout → SimpleRouteJson traces and differential-pair measurement (spec/api/contract.md
 * "SimpleRouteJson"; spec/types/srj.ts). After the core `route()` has added copper, this module
 * reads the router-added Tracks and Barrels back out as `pcb_trace` elements with `wire` and `via`
 * steps (millimetre units), and measures each differential pair's two members: routed length of
 * each and the length skew between them. Coupled (side-by-side) routing is out of scope for I6, so
 * a pair is measured, not co-routed. Derived from spec/types/srj.ts and docs/DESIGN.md §1.
 *
 * Public surface: extractTraces, measurePairs, PairSpec, normalisePairs.
 */
import type { Barrel, Layout, Pt, Track } from "../../spec/types/layout.ts";
import type { SimpleRouteJson, SrjRouteStep, SrjTrace } from "../../spec/types/srj.ts";

/** LU → file units (mm); the Frame's origin shift is zero for SRJ Layouts. */
function toMm(frame: Layout["frame"], v: number): number {
  const mm = v / frame.luPerUnit;
  return Math.round(mm * 1e6) / 1e6;
}

function segLenLu(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Routed length (LU) of one net's router-added Tracks. */
function netTrackLengthLu(layout: Layout, netId: number): number {
  let total = 0;
  for (const t of layout.tracks) {
    if (t.net !== netId || t.origin !== "router") continue;
    for (let i = 0; i + 1 < t.pts.length; i++) total += segLenLu(t.pts[i]!, t.pts[i + 1]!);
  }
  return total;
}

/**
 * One `pcb_trace` per connection with router-added copper: its Tracks become `wire` runs, its
 * Barrels `via` steps. Tracks ordered by id, Barrels appended (this milestone routes one Track and
 * no vias per connection, so the ordering never fragments a run).
 */
export function extractTraces(
  layout: Layout,
  connectionByNet: Map<number, string>,
  layerBySheet: Map<number, string>,
): SrjTrace[] {
  const out: SrjTrace[] = [];
  const layerOf = (sheet: number): string => layerBySheet.get(sheet) ?? String(sheet);
  const tracksByNet = new Map<number, Track[]>();
  for (const t of layout.tracks) {
    if (t.origin !== "router" || t.net === null || t.pts.length < 2) continue;
    (tracksByNet.get(t.net) ?? tracksByNet.set(t.net, []).get(t.net)!).push(t);
  }
  const barrelsByNet = new Map<number, Barrel[]>();
  for (const b of layout.barrels) {
    if (b.origin !== "router" || b.net === null) continue;
    (barrelsByNet.get(b.net) ?? barrelsByNet.set(b.net, []).get(b.net)!).push(b);
  }
  const nets = [...new Set([...tracksByNet.keys(), ...barrelsByNet.keys()])].sort((a, b) => a - b);
  for (const netId of nets) {
    const name = connectionByNet.get(netId);
    if (name === undefined) continue;
    const route: SrjRouteStep[] = [];
    const tracks = (tracksByNet.get(netId) ?? []).slice().sort((a, b) => a.id - b.id);
    for (const t of tracks) {
      const widthMm = toMm(layout.frame, t.width);
      const layer = layerOf(t.sheet);
      for (const p of t.pts) route.push({ route_type: "wire", x: toMm(layout.frame, p.x), y: toMm(layout.frame, p.y), width: widthMm, layer });
    }
    for (const b of (barrelsByNet.get(netId) ?? []).slice().sort((x, y) => x.id - y.id)) {
      route.push({ route_type: "via", x: toMm(layout.frame, b.at.x), y: toMm(layout.frame, b.at.y), from_layer: layerOf(b.fromSheet), to_layer: layerOf(b.toSheet) });
    }
    if (route.length > 0) out.push({ type: "pcb_trace", pcb_trace_id: `pcb_trace_${name}`, connection_name: name, route });
  }
  return out;
}

/** A differential pair normalised to a positive member `p`, negative `n` and a skew tolerance. */
export interface PairSpec { p: string; n: string; skewToleranceMm?: number }

/**
 * Normalise the input `differentialPairs` (spec type `{p, n}` or the boards' `{connectionNames}`)
 * to `PairSpec`. For a two-name list the `_P`-suffixed name is `p` and `_N` is `n`; failing a
 * suffix match, index 1 is `p` and index 0 is `n` (the boards list N before P).
 */
export function normalisePairs(input: unknown): PairSpec[] {
  if (!Array.isArray(input)) return [];
  const out: PairSpec[] = [];
  for (const raw of input) {
    const o = raw as Record<string, unknown>;
    let p = typeof o.p === "string" ? o.p : undefined;
    let n = typeof o.n === "string" ? o.n : undefined;
    if ((p === undefined || n === undefined) && Array.isArray(o.connectionNames)) {
      const cn = (o.connectionNames as unknown[]).filter((x): x is string => typeof x === "string");
      if (cn.length >= 2) {
        const byP = cn.find((x) => /_p$/i.test(x));
        const byN = cn.find((x) => /_n$/i.test(x));
        p = byP ?? cn[1];
        n = byN ?? cn[0];
      }
    }
    if (p === undefined || n === undefined) continue;
    const tol = typeof o.skewToleranceMm === "number" ? o.skewToleranceMm
      : typeof o.lengthTolerance === "number" ? o.lengthTolerance : undefined;
    out.push(tol !== undefined ? { p, n, skewToleranceMm: tol } : { p, n });
  }
  return out;
}

export interface PairMeasure { p: string; n: string; lengthP: number; lengthN: number; skewMm: number; withinTolerance: boolean }

/** Measure both members of each differential pair: routed length (mm) and length skew (mm). */
export function measurePairs(
  layout: Layout,
  pairs: PairSpec[],
  netByConnection: Map<string, number>,
): PairMeasure[] {
  const lengthOf = (name: string): number => {
    const net = netByConnection.get(name);
    return net === undefined ? 0 : toMm(layout.frame, netTrackLengthLu(layout, net));
  };
  return pairs.map((pair) => {
    const lengthP = lengthOf(pair.p);
    const lengthN = lengthOf(pair.n);
    const skewMm = Math.abs(lengthP - lengthN);
    const withinTolerance = pair.skewToleranceMm === undefined ? true : skewMm <= pair.skewToleranceMm;
    return { p: pair.p, n: pair.n, lengthP, lengthN, skewMm, withinTolerance };
  });
}
