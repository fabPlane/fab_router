/**
 * Coarse negotiated global routing (docs/DESIGN.md §10.3). Literature: McMurchie & Ebeling (1995)
 * "PathFinder" — the negotiation converges because *every* Segment is ripped and rerouted against
 * the shared cost field each iteration (erasing the first-come advantage the M9 local loop cannot
 * shed), with a present-sharing term and a history term that ratchets up on persistently over-full
 * resources; Kastner et al. (2002) Labyrinth and Pan/Xu/Chu (2006–09) FastRoute — negotiated
 * *global* routing on a coarse capacity grid, cheap because no exact geometric predicate is paid;
 * Cho & Pan (2006–07) BoxRouter — layer assignment by biasing each Sheet toward its preferred
 * direction, so axis-aligned Segments land on the matching Sheet (the H/V spreading that reproduces
 * the cm5 reference). Hart/Nilsson/Raphael (1968) A* and Lee (1961) maze search — the per-Segment
 * search over Bins.
 *
 * This phase writes only Mesh usage/history and the Plan's Corridors. It **commits no copper**, so
 * R-1 cannot be affected (§10.5); a capacity-0 Bridge (fixed blockage fully covers it — R-2) is
 * impassable, so the coarse plan can never route through immovable copper.
 *
 * Cost of crossing a Bridge (docs/DESIGN.md §10.3):
 *   `(base + presentWeight · projectedOverflow) · (1 + historyWeight · history)`
 * where `projectedOverflow = max(0, usage + 1 − capacity)` is the Overflow this Segment would add
 * (0 while the Bridge has slack, so slack is shared freely and only real contention is penalised),
 * `base` is 1 for an in-plane move and grows by `layerBiasFactor` when the move's direction fights
 * the Sheet's preferred direction (BoxRouter), and `historyWeight` is escalated by `historyRamp`
 * each iteration so oscillation is damped out.
 *
 * Public surface: NegotiateOptions, DEFAULT_NEGOTIATE_OPTIONS, sheetPreferDirs, negotiate.
 */
import type { Layout } from "../../spec/types/layout.ts";
import { Heap } from "./search.ts";
import type { Mesh } from "./mesh.ts";
import type { Corridor, Plan, Segment } from "./plan.ts";
import { orderSegments } from "./plan.ts";

export interface NegotiateOptions {
  /** Iteration cap (`globalMaxIterations`). Stops earlier when total Overflow reaches 0. */
  maxIterations: number;
  /** Stop early after this many iterations with no improvement in total Overflow (0 disables). */
  maxStagnant: number;
  /** Heuristic inflation for the per-Segment A*: >1 is bounded-suboptimal (FastRoute-style) and
   *  much faster on a coarse Mesh where Corridors are only guidance. 1 = admissible A*. */
  heuristicWeight: number;
  /** Present-sharing weight on projected Overflow (`globalPresentWeight`). */
  presentWeight: number;
  /** History weight, iteration 0 (`globalHistoryWeight`). */
  historyWeight: number;
  /** Multiplicative escalation of the history weight per iteration (`globalHistoryRamp`). */
  historyRamp: number;
  /** Bias in-plane Bridges toward each Sheet's preferred direction (`globalLayerBias`). */
  layerBias: boolean;
  /** Base-cost multiplier when a move fights the Sheet's preferred direction. */
  layerBiasFactor: number;
  /** Base-cost multiplier for an inter-Sheet (via) move. */
  viaFactor: number;
  /** Added base cost for crossing a capacity-0 Bridge (fixed blockage). Strongly avoided, but not
   *  hard-blocked: a pin's own copper walls its Bin in the coarse model, so the escape must remain
   *  passable; the Corridor only guides the detailed router (docs/DESIGN.md §10.4), which re-checks
   *  the exact predicate, so planning across a nominally-blocked coarse Bridge causes a detailed
   *  miss, never a violation (R-1 holds). */
  blockedCost: number;
  /** Preferred direction per Mesh Sheet index; missing/null falls back to the alternating rule. */
  preferDir?: readonly ("h" | "v" | null | undefined)[];
  /**
   * Preserve the Mesh's accumulated history across this call instead of zeroing it (default
   * false = a fresh negotiation). The global↔detailed feedback loop (task I16, M10e; docs/DESIGN.md
   * §10.4b/§10.7 M10e) sets this so the history bumped on the Bridges an *unrealisable* Corridor
   * could not cross survives into the re-negotiation — which is exactly what makes the coarse plan
   * RESPOND to a detailed failure and drive the detailed router down a *different* corridor next
   * iteration (the escalating-history property that makes PathFinder converge; McMurchie & Ebeling
   * 1995). Usage and present are always rebuilt (Corridors are re-planned from scratch each call).
   */
  keepHistory?: boolean;
}

export const DEFAULT_NEGOTIATE_OPTIONS: NegotiateOptions = {
  maxIterations: 40,
  maxStagnant: 10,
  heuristicWeight: 1.1,
  presentWeight: 12,
  historyWeight: 1,
  historyRamp: 1.1,
  layerBias: true,
  layerBiasFactor: 3,
  viaFactor: 2,
  blockedCost: 500,
};

/**
 * Effective preferred direction per Mesh Sheet index for layer bias. An explicit `Sheet.preferDir`
 * wins; otherwise Sheets alternate H/V starting from the board's longer-side direction
 * (Q-I1-39 / L-09 longer-side default extended to the classic per-layer H/V spread that BoxRouter
 * layer assignment needs — recorded in src/QUESTIONS.md).
 */
export function sheetPreferDirs(layout: Layout, mesh: Mesh): ("h" | "v")[] {
  const longer: "h" | "v" = (mesh.box.x1 - mesh.box.x0) >= (mesh.box.y1 - mesh.box.y0) ? "h" : "v";
  const byId = new Map(layout.stack.map((s) => [s.id, s.preferDir] as const));
  return mesh.sheets.map((sheetId, i) => {
    const set = byId.get(sheetId);
    if (set === "h" || set === "v") return set;
    return i % 2 === 0 ? longer : (longer === "h" ? "v" : "h");
  });
}

/**
 * Drive the Mesh to zero Overflow (or the iteration cap) by coarse PathFinder negotiation, filling
 * one Corridor per Segment. Deterministic: Segments are routed in `orderSegments` order every
 * iteration, the per-Segment A* expands Bridges in ascending id (Mesh `bridgesOf`) and breaks heap
 * ties by insertion sequence, and no Map iteration order reaches a decision.
 */
export function negotiate(mesh: Mesh, segments: readonly Segment[], opt: Partial<NegotiateOptions> = {}): Plan {
  const o: NegotiateOptions = { ...DEFAULT_NEGOTIATE_OPTIONS, ...opt };
  const order = orderSegments(mesh, segments);
  const nx = mesh.nx, ny = mesh.ny, bps = nx * ny;
  const S = mesh.sheets.length;

  // Resolve per-Sheet-index preferred direction: an explicit entry wins, else the alternating
  // longer-side fallback (BoxRouter H/V layer spreading).
  const longer: "h" | "v" = (mesh.box.x1 - mesh.box.x0) >= (mesh.box.y1 - mesh.box.y0) ? "h" : "v";
  const dirOf: ("h" | "v")[] = mesh.sheets.map((_id, i) => {
    const s = o.preferDir?.[i];
    if (s === "h" || s === "v") return s;
    return i % 2 === 0 ? longer : (longer === "h" ? "v" : "h");
  });

  // Reset the negotiation fields (defensive: a fresh Mesh starts at 0, but a reused one may not).
  // Usage and present are always rebuilt (Corridors are re-planned this call); history is zeroed
  // for a fresh negotiation but *preserved* under `keepHistory` so the feedback loop's escalating
  // history survives into the re-negotiation (task I16, M10e — see NegotiateOptions.keepHistory).
  for (let b = 0; b < mesh.bridgeCount; b++) {
    mesh.setUsage(b, 0);
    mesh.setPresent(b, 0);
    if (!o.keepHistory) mesh.addHistory(b, -mesh.historyOf(b));
  }

  const corridors: Corridor[] = segments.map((s) => ({ segment: s.id, bins: [], bridges: [], sheet: -1, realised: false }));

  // A* scratch, generation-stamped so it need not be cleared between searches.
  const binCount = mesh.binCount;
  const gGen = new Int32Array(binCount);
  const gScore = new Float64Array(binCount);
  const parentBin = new Int32Array(binCount);
  const parentBridge = new Int32Array(binCount);
  const closedGen = new Int32Array(binCount);
  let gen = 0;
  let seq = 0;

  const decodeSheetIndex = (bin: number): number => Math.floor(bin / bps);

  const bridgeCost = (bridgeId: number, fromBin: number, kind: "x" | "y" | "via", historyWeightEff: number): number => {
    const cap = mesh.capacityOf(bridgeId);
    const usage = mesh.usageOf(bridgeId);
    const hist = mesh.historyOf(bridgeId);
    const proj = Math.max(0, usage + 1 - cap);
    let base = 1;
    if (kind === "via") {
      base *= o.viaFactor;
    } else if (o.layerBias) {
      const want = kind === "x" ? "h" : "v"; // an x-Bridge is an East/West (horizontal) move
      if (dirOf[decodeSheetIndex(fromBin)] !== want) base *= o.layerBiasFactor;
    }
    if (cap <= 0) base += o.blockedCost; // fixed blockage: strongly avoided, not impassable
    return (base + o.presentWeight * proj) * (1 + historyWeightEff * hist);
  };

  /** A* from any of `starts` to any of `goals`; returns the Bin path and crossed Bridges, or null. */
  const search = (starts: readonly number[], goals: readonly number[], historyWeightEff: number): { bins: number[]; bridges: number[] } | null => {
    const goalSet = new Set<number>();
    let gbx = -1, gby = -1;
    const goalSheets: number[] = [];
    for (const g of goals) { if (g < 0) continue; goalSet.add(g); const si = decodeSheetIndex(g); const rem = g - si * bps; gbx = rem % nx; gby = Math.floor(rem / nx); goalSheets.push(si); }
    if (goalSet.size === 0) return null;
    const heuristic = (bin: number): number => {
      const si = decodeSheetIndex(bin), rem = bin - si * bps;
      const bx = rem % nx, by = Math.floor(rem / nx);
      let ds = Infinity;
      for (const gs of goalSheets) ds = Math.min(ds, Math.abs(si - gs));
      return (Math.abs(bx - gbx) + Math.abs(by - gby) + ds) * o.heuristicWeight;
    };

    gen++;
    const heap = new Heap();
    for (const s of starts) {
      if (s < 0) continue;
      gGen[s] = gen; gScore[s] = 0; parentBin[s] = -1; parentBridge[s] = -1;
      heap.push({ f: heuristic(s), h: heuristic(s), seq: seq++, state: s });
    }
    while (heap.size > 0) {
      const node = heap.pop();
      const s = node.state;
      if (closedGen[s] === gen) continue;
      closedGen[s] = gen;
      if (goalSet.has(s)) {
        const bins: number[] = [], bridges: number[] = [];
        let cur = s;
        while (cur !== -1) { bins.push(cur); const br = parentBridge[cur]!; if (br >= 0) bridges.push(br); cur = parentBin[cur]!; }
        bins.reverse(); bridges.reverse();
        return { bins, bridges };
      }
      for (const bridgeId of mesh.bridgesOf(s)) {
        const br = mesh.bridge(bridgeId);
        const nb = br.a === s ? br.b : br.a;
        const ng = gScore[s]! + bridgeCost(bridgeId, s, br.kind, historyWeightEff);
        if (gGen[nb] !== gen || ng < gScore[nb]!) {
          gGen[nb] = gen; gScore[nb] = ng; parentBin[nb] = s; parentBridge[nb] = bridgeId;
          const h = heuristic(nb);
          heap.push({ f: ng + h, h, seq: seq++, state: nb });
        }
      }
    }
    return null;
  };

  const applyCorridor = (c: Corridor, delta: number): void => { for (const b of c.bridges) mesh.addUsage(b, delta); };

  const routeSegment = (seg: Segment, historyWeightEff: number): void => {
    const c = corridors[seg.id]!;
    if (c.realised) applyCorridor(c, -1); // rip
    const found = search(seg.from.bins, seg.to.bins, historyWeightEff);
    if (found && found.bins.length > 0) {
      c.bins = found.bins; c.bridges = found.bridges; c.sheet = decodeSheetOf(mesh, found.bins[0]!); c.realised = true;
      applyCorridor(c, +1);
    } else {
      c.bins = []; c.bridges = []; c.sheet = -1; c.realised = false;
    }
  };

  const byId: Segment[] = [];
  for (const s of segments) byId[s.id] = s;

  // Keep-best: the negotiation can oscillate, so the returned Plan is the least-Overflow iteration
  // seen, not the last (the spirit of the keep-best discipline of docs/DESIGN.md §10.6).
  const cloneCorridors = (): Corridor[] => corridors.map((c) => ({ segment: c.segment, bins: c.bins.slice(), bridges: c.bridges.slice(), sheet: c.sheet, realised: c.realised }));
  let iterations = 0;
  let overflow = 0;
  let best = Infinity;
  let bestCorridors = corridors;
  let stagnant = 0;
  for (let iter = 0; iter < o.maxIterations; iter++) {
    iterations = iter + 1;
    const historyWeightEff = o.historyWeight * Math.pow(o.historyRamp, iter);
    for (const segId of order) routeSegment(byId[segId]!, historyWeightEff);
    // Accumulate history on over-full Bridges and measure residual Overflow.
    overflow = 0;
    for (let b = 0; b < mesh.bridgeCount; b++) {
      const ov = mesh.overflowOf(b);
      if (ov > 0) { mesh.addHistory(b, ov); overflow += ov; }
    }
    if (overflow < best) { best = overflow; bestCorridors = cloneCorridors(); stagnant = 0; }
    else if (++stagnant >= o.maxStagnant && o.maxStagnant > 0) break;
    if (overflow === 0) break;
  }

  const unrealised = bestCorridors.reduce((n, c) => n + (c.realised ? 0 : 1), 0);
  return { segments, order, corridors: bestCorridors, overflow: best, iterations, unrealised };
}

function decodeSheetOf(mesh: Mesh, bin: number): number {
  return mesh.binAt(bin).sheet;
}
