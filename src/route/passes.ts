/**
 * Passes — the routing stage: an ordered queue of the Layout's incomplete required connections
 * swept over `maxPasses` passes, with stagnation / item-count / time / abort stops (docs/DESIGN.md
 * §6 `passes.ts`, §7). For one connection it resolves a Profile (src/route/profile.ts), then tries,
 * in order: fast line probes and A* on a shared usable Sheet (Hart et al. 1968; Soukup 1978); a
 * cross-Sheet route through a single Barrel or a two-Barrel jog to a clearer Sheet; the multilayer
 * A* with Barrel drops (src/route/search.ts `aStarLayered`); negotiated-congestion rip-up with
 * soft obstacles and PathFinder resource history (McMurchie & Ebeling 1995) and local nudge
 * (src/route/nudge.ts). Plane-net connections drop a Barrel spanning the plane Sheet into the Pour
 * (K-04/K-07). Every leg is string-pulled (Nash et al. 2007) and legalised with exact `sweepClear`
 * checks before it reaches the Journal. Determinism (docs/DESIGN.md §7): connections in a fixed
 * `(net, id)` order, fixed Sheet order, sequence-tie-broken heap, deterministic via-candidate rings.
 *
 * Nothing is inserted unless every leg / Barrel passed the exact clearance predicate, so
 * router-added violations are zero by construction (contract R-1); `held` / `locked` items are
 * never touched (R-2); `maxItems` bounds the inserted Tracks plus Barrels (R-5, cases' ruling). A
 * keep-best rewind returns the fewest-incomplete state seen when negotiation churns.
 *
 * Public surface: RouteCtx, PassOutcome, routeConnection, runPasses, createCtx, totalIncomplete,
 * perNetIncomplete.
 */
import type { Barrel, Layout, Pad, Pour, Pt } from "../../spec/types/layout.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";
import type { RouteHooks } from "../../spec/types/results.ts";
import type { Box } from "../geom/index.ts";
import { boxOfPts, dist2PtPt } from "../geom/index.ts";
import { connectivity, incompleteCount, ignoredNets, requiredConnectionsOf, type Connectivity } from "../drc/index.ts";
import type { Connection } from "../../spec/types/results.ts";
import { barrelSheets, buildLattice, type Lattice } from "../lattice/index.ts";
import { createJournal, type Journal } from "./journal.ts";
import { resolveProfile, type Profile } from "./profile.ts";
import { ignoreOf, pointFree, sweepClear, type IgnoreSet } from "./clear.ts";
import { createQuilt } from "./quilt.ts";
import { aStar, aStarLayered, DIRS_4, DIRS_8, type EdgeCost, type LayeredSpace, type SearchSpace, type CorridorBias, type LayeredCorridorBias } from "./search.ts";
import { buildMesh, type Mesh } from "./mesh.ts";
import { steinerDecompose } from "./steiner.ts";
import { negotiate, type NegotiateOptions } from "./negotiate.ts";
import type { Plan, Segment } from "./plan.ts";
import { pullPath } from "./pull.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { createRipupHistory, isRippable, ripCost, cellHistory, presentFactor, type RipupHistory } from "./ripup.ts";
import type { Track } from "../../spec/types/layout.ts";
import { barrelFits } from "./clear.ts";
import { pickBarrel, dropViaNear } from "./via.ts";
import { nudgeClear, type RerouteFn } from "./nudge.ts";
import { shoveClear, type ShoveBudget } from "./shove.ts";
import { lineProbeRoute, type LineProbeOptions } from "./lineprobe.ts";
import { channelRoute, type ChannelOptions } from "./channel.ts";
import type { BarrelCandidate } from "./profile.ts";

export interface RouteCtx {
  layout: Layout;
  lattice: Lattice;
  journal: Journal;
  settings: RouteSettings;
  hooks?: RouteHooks | undefined;
  ripHistory: RipupHistory;
  ignored: Set<number>;
  startMs: number;
  deadline: number | undefined;
  /** Tracks + Barrels present when the run began (baseline for the R-5 item cap). */
  baseItems: number;
  /** Completed-connection tally (bounded by `maxItems`). */
  completed: number;
  /** Distinct connection attempts made across all passes. */
  attempted: number;
  ripped: number;
  profiles: Map<number | null, Profile>;
  /** Default preferred direction per Sheet id (settings.md), computed once. */
  preferDir: Map<number, "h" | "v" | null>;
  /** Plane Sheet ids (role "plane"), for K-07 plane-net completion. */
  planeSheets: Set<number>;
  /** Whether rip-up is allowed this pass (off on the first, stabilising pass). */
  ripupActive: boolean;
  /** The connectivity computed at the start of the current pass (for Prior-copper attachment). */
  conn?: Connectivity;
  /** Per-connection contention (times a connection failed to route): the local-congestion term of
   *  the difficulty order (Nair 1987), keyed `${net}:${from}:${to}`. */
  contention: Map<string, number>;
  /** SPIKE I17: when set, the soft A* edge cost uses the detailed-negotiation form
   *  `base·(1 + present·pw + history·hw)` with this history weight `hw` (escalated per pass); when
   *  undefined the legacy soft cost is used unchanged, so the default path is byte-identical. */
  negHistoryWeight?: number | undefined;
  /** SPIKE I17: present-sharing weight `pw` for the detailed-negotiation soft edge cost. */
  negPresentWeight?: number | undefined;
}

export interface PassOutcome {
  passes: number;
  stoppedBy: RouteReportStop;
  timedOut: boolean;
  aborted: boolean;
}

type RouteReportStop = "complete" | "maxPasses" | "stagnant" | "maxItems" | "timeBudget" | "abort";

const MAX_REGION_CELLS = 220_000;
// A* node-pop cap. The per-edge test is the exact clearance predicate, so pops are the dominant
// cost; a bound keeps a single connection's search affordable on a large, congested board (the
// Quilt only proposes, so a capped search can miss but never violate — docs/DESIGN.md §6).
const MAX_POPS = 30_000;
// A shared "clear, nothing ripped" edge result. The A* loop calls `edgeCost` once per neighbour and
// only ever reads these fields, so returning one frozen constant instead of a fresh object + array
// removes an allocation per expansion on the hard-obstacle fast path (task I11, M9c). It must never
// be mutated by a caller; the search and `collectRip` only read it.
const CLEAR_EDGE: EdgeCost = { blocked: false, extra: 0, rip: Object.freeze([]) as readonly number[] };
// Fewest incompletes a stalled board must still carry for the difficulty-ordered rescue to be worth
// its extra passes; below it the negotiated-congestion loop has essentially converged and a rescue
// would only add cost (protects the fast tier's timing — task I8 deliverable 5).
const RESCUE_MIN_INCOMPLETE = 12;

// SPIKE I17 — full detailed negotiated-congestion loop (McMurchie & Ebeling 1995). Default history
// weight `hw` at pass 0, its per-pass increment (the escalation schedule), and the present-sharing
// weight `pw`. Overridable via the reused global* settings for the measurement sweep.
const DN_HISTORY_BASE = 1;
const DN_HISTORY_RAMP = 1;
const DN_PRESENT_WEIGHT = 1;

function now(): number { return Date.now(); }

/** Net Tracks + Barrels added since the run began (the R-5 item cap, cases' ruling). */
function addedItems(ctx: RouteCtx): number {
  return ctx.layout.tracks.length + ctx.layout.barrels.length - ctx.baseItems;
}

/** Rip a set of ids (Journal), bumping per-item and per-resource-cell history (PathFinder). */
function ripAll(ctx: RouteCtx, ids: readonly number[]): void {
  for (const id of ids) {
    const entry = ctx.lattice.itemOf(id);
    if (entry?.cat === "track") {
      const t = entry.item as Track;
      for (let i = 1; i < t.pts.length; i++) ctx.ripHistory.bumpSeg(t.sheet, t.pts[i - 1]!, t.pts[i]!);
    }
    ctx.journal.remove(id);
    ctx.ripHistory.bump(id);
  }
}

function timeUp(ctx: RouteCtx): boolean {
  return ctx.deadline !== undefined && now() > ctx.deadline;
}
function abortRequested(ctx: RouteCtx): boolean {
  return ctx.hooks?.signal?.aborted === true;
}

// ---- endpoint resolution --------------------------------------------------------------------

interface Endpoint { pt: Pt; sheets: number[]; center: Pt }

function findItem(layout: Layout, id: number): { kind: "pad" | "barrel" | "pour"; item: Pad | Barrel | Pour } | undefined {
  const pad = layout.pads.find((p) => p.id === id);
  if (pad) return { kind: "pad", item: pad };
  const barrel = layout.barrels.find((b) => b.id === id);
  if (barrel) return { kind: "barrel", item: barrel };
  const pour = layout.pours.find((p) => p.id === id);
  if (pour) return { kind: "pour", item: pour };
  return undefined;
}

function centerOf(layout: Layout, e: { kind: string; item: Pad | Barrel | Pour }): Pt {
  if (e.kind === "pour") {
    const p = e.item as Pour;
    return centroid(p.outline);
  }
  return (e.item as Pad | Barrel).at;
}

function sheetsOf(layout: Layout, e: { kind: string; item: Pad | Barrel | Pour }): number[] {
  if (e.kind === "pad") return (e.item as Pad).sheets.slice();
  if (e.kind === "barrel") return barrelSheets(layout, e.item as Barrel);
  return [(e.item as Pour).sheet];
}

function centroid(pts: readonly Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: Math.round(x / pts.length), y: Math.round(y / pts.length) };
}

function nearestVertex(pts: readonly Pt[], to: Pt): Pt {
  let best = pts[0]!, bestD = Infinity;
  for (const p of pts) { const d = dist2PtPt(p, to); if (d < bestD) { bestD = d; best = p; } }
  return best;
}

function resolveEndpoints(layout: Layout, fromId: number, toId: number): { from: Endpoint; to: Endpoint } | undefined {
  const a = findItem(layout, fromId), b = findItem(layout, toId);
  if (!a || !b) return undefined;
  const ca = centerOf(layout, a), cb = centerOf(layout, b);
  const aPt = a.kind === "pour" ? nearestVertex((a.item as Pour).outline, cb) : ca;
  const bPt = b.kind === "pour" ? nearestVertex((b.item as Pour).outline, aPt) : cb;
  return {
    from: { pt: aPt, center: ca, sheets: sheetsOf(layout, a) },
    to: { pt: bPt, center: cb, sheets: sheetsOf(layout, b) },
  };
}

// ---- per-Sheet costs --------------------------------------------------------------------------

interface SheetCost { along: number; against: number; preferDir: "h" | "v" | null }

function sheetCostOf(ctx: RouteCtx, sheetId: number): SheetCost {
  const layout = ctx.layout, s = ctx.settings;
  const sheet = layout.stack.find((x) => x.id === sheetId);
  const name = sheet?.name ?? "";
  const ov = s.layers[name];
  const preferDir = ov?.preferDir ?? sheet?.preferDir ?? ctx.preferDir.get(sheetId) ?? null;
  const along = ov?.alongCost ?? 1;
  const against = ov?.againstCost ?? s.preferredDirectionCost;
  return { along, against, preferDir };
}

/** Default preferred directions (settings.md): first signal Sheet along the board's longer side, then alternate. */
function defaultPreferDirs(layout: Layout): Map<number, "h" | "v" | null> {
  const out = new Map<number, "h" | "v" | null>();
  let first: "h" | "v" = "h";
  if (layout.rim && layout.rim.outline.length >= 2) {
    const b = boxOfPts(layout.rim.outline);
    first = b.x1 - b.x0 >= b.y1 - b.y0 ? "h" : "v";
  }
  let idx = 0;
  for (const s of layout.stack) {
    if (s.role !== "signal") { out.set(s.id, null); continue; }
    out.set(s.id, idx % 2 === 0 ? first : first === "h" ? "v" : "h");
    idx++;
  }
  return out;
}

// ---- one connection ---------------------------------------------------------------------------

function profileFor(ctx: RouteCtx, net: number | null): Profile {
  let p = ctx.profiles.get(net);
  if (!p) { p = resolveProfile(ctx.layout, net, ctx.settings); ctx.profiles.set(net, p); }
  return p;
}

function perConnDeadlineOf(ctx: RouteCtx): number | undefined {
  return ctx.settings.connectionBudgetMs !== undefined
    ? Math.min(ctx.deadline ?? Infinity, now() + ctx.settings.connectionBudgetMs)
    : ctx.deadline;
}

/** Try to complete one connection; returns true when copper was inserted. */
export function routeConnection(ctx: RouteCtx, conn: Connection): boolean {
  const ends = resolveEndpoints(ctx.layout, conn.from, conn.to);
  if (!ends) return false;
  const profile = profileFor(ctx, conn.net);
  const ignore = ignoreOf(conn.net);
  const deadline = perConnDeadlineOf(ctx);
  const viasOk = ctx.settings.viasAllowed && profile.barrelForms.length > 0;

  const inUsable = (s: number): boolean => profile.sheets.includes(s);
  const fromUsable = ends.from.sheets.filter(inUsable);
  const toUsable = ends.to.sheets.filter(inUsable);

  // Plane-net completion (K-07 / K-04): join a signal endpoint to a plane Pour with a Barrel that
  // spans the plane Sheet. Attempted only when exactly one endpoint sits on a plane Sheet.
  if (profile.planeNet && viasOk) {
    const fromPlane = ends.from.sheets.some((s) => ctx.planeSheets.has(s));
    const toPlane = ends.to.sheets.some((s) => ctx.planeSheets.has(s));
    if (fromPlane !== toPlane) {
      const sigPt = fromPlane ? ends.to.pt : ends.from.pt;
      const sigUsable = fromPlane ? toUsable : fromUsable;
      const planeEnd = fromPlane ? ends.from : ends.to;
      const planeSheet = planeEnd.sheets.find((s) => ctx.planeSheets.has(s)) ?? planeEnd.sheets[0]!;
      if (sigUsable.length > 0 && tryPlaneVia(ctx, conn.net, sigPt, sigUsable, planeSheet, profile, ignore)) return true;
    }
  }

  const common = fromUsable.filter((s) => toUsable.includes(s)).sort((x, y) => x - y);

  // 1) Fast straight / L probes on a shared Sheet (cheap, no detour).
  for (const sheet of common) {
    if (fastProbe(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore)) return true;
  }

  // 1a) Attach to same-net Prior copper (task I7 gap 1; K-16, spec/formats/srj.md J-34). When one
  // endpoint's component already carries the net's Prior copper, reaching that copper from the other
  // endpoint completes the connection — usually a far shorter, clearer route than pad→pad across the
  // dense board. The bridging Barrels emitted at import (src/srj/build.ts) make each physical via's
  // Prior copper a single cross-Sheet component, so a bottom-Sheet attach can complete a connection
  // whose Prior route runs over the top Sheet.
  if (tryAttachPrior(ctx, conn, ends, fromUsable, toUsable, profile, ignore, deadline)) return true;
  const multilayer = (): boolean => {
    if (!(viasOk && fromUsable.length > 0 && toUsable.length > 0)) return false;
    if (tryRouteViaPoints(ctx, conn.net, ends.from.pt, ends.to.pt, fromUsable, toUsable, profile, ignore, deadline, false)) return true;
    // The layered A* finds Barrel jogs naturally and cheaply; the explicit candidate-ring jog is
    // only a last resort (it is O(candidates²) and expensive on large boards).
    if (tryRouteLayered(ctx, conn.net, ends.from.pt, ends.to.pt, fromUsable, toUsable, profile, ignore, deadline, false)) return true;
    for (const sheet of common) {
      if (tryRouteViaJog(ctx, conn.net, ends.from.pt, ends.to.pt, sheet, profile, ignore, deadline, false)) return true;
    }
    return false;
  };
  const sameSheetAstar = (): boolean => {
    for (const sheet of common) {
      if (tryRouteOnSheet(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore, deadline, false)) return true;
    }
    return false;
  };
  // Under an item cap the metric is completed connections, and a single-Sheet route costs one
  // Track while a Barrel route costs several items; so prefer single-Sheet routes and leave a
  // cross-Sheet connection for the budget rather than spending it on Barrels. Without a cap,
  // spread across layers before a long same-Sheet detour.
  if (ctx.settings.maxItems !== undefined) {
    if (sameSheetAstar()) return true;
  } else {
    if (multilayer()) return true;
    if (sameSheetAstar()) return true;
  }
  // 3) Shove, then negotiated-congestion rip-up (soft obstacles), then local nudge.
  if (ctx.settings.ripupEnabled && ctx.ripupActive) {
    // Shove rung (§9a): displace the movable free Tracks blocking the direct leg within their slack,
    // each kept whole and DRC-clean, before resorting to ripping and rerouting them from scratch.
    for (const sheet of common) {
      if (tryShoveRoute(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore, deadline)) return true;
    }
    for (const sheet of common) {
      if (tryRouteOnSheet(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore, deadline, true)) return true;
    }
    for (const sheet of common) {
      if (tryNudgeRoute(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore, deadline)) return true;
    }
    if (viasOk && ctx.settings.maxItems === undefined && fromUsable.length > 0 && toUsable.length > 0) {
      if (tryRouteViaPoints(ctx, conn.net, ends.from.pt, ends.to.pt, fromUsable, toUsable, profile, ignore, deadline, true)) return true;
      if (tryRouteLayered(ctx, conn.net, ends.from.pt, ends.to.pt, fromUsable, toUsable, profile, ignore, deadline, true)) return true;
    }
  }

  // 4) Detailed router (§9b): the gridless last-resort rungs. Reached only when every faster tier
  // missed this connection. Off by default, so the fast tier is untouched; when enabled they are
  // limited to previously-failed connections in later passes (contention already recorded and
  // `ripupActive`), so fast-tier timing does not regress. R-1/R-2 hold by construction (both the
  // line search and the channel router re-check every leg with the exact predicate and roll back
  // atomically). `lineprobe` runs the line search (§9b-1); `tiles` runs it first, then the
  // corner-stitched channel router (§9b-2) for the channels the line search still misses.
  const detailed = ctx.settings.detailedRouter;
  if ((detailed === "lineprobe" || detailed === "tiles") && ctx.ripupActive
    && ctx.contention.has(`${conn.net}:${conn.from}:${conn.to}`)) {
    if (tryLineprobeRoute(ctx, conn.net, ends, fromUsable, toUsable, profile, ignore, deadline)) return true;
    if (detailed === "tiles"
      && tryChannelRoute(ctx, conn.net, ends, fromUsable, toUsable, profile, ignore, deadline)) return true;
  }
  return false;
}

/** Per-connection options for the detailed line-search: the `detailedBudgetMs` cap and abort signal. */
function lineProbeOptsOf(ctx: RouteCtx, deadline: number | undefined): LineProbeOptions {
  const dl = ctx.settings.detailedBudgetMs !== undefined
    ? Math.min(deadline ?? Infinity, now() + ctx.settings.detailedBudgetMs)
    : deadline;
  return {
    ...(dl !== undefined && dl !== Infinity ? { deadline: dl } : {}),
    ...(ctx.hooks?.signal ? { signal: ctx.hooks.signal } : {}),
    ...(ctx.settings.detailedMaxTiles !== undefined ? { maxEscapes: ctx.settings.detailedMaxTiles } : {}),
  };
}

/** Line-search detailed rung (§9b-1): thread a locked channel the grid tier is too coarse for. */
function tryLineprobeRoute(
  ctx: RouteCtx, net: number | null, ends: { from: Endpoint; to: Endpoint },
  fromUsable: number[], toUsable: number[], profile: Profile, ignore: IgnoreSet, deadline: number | undefined,
): boolean {
  const viasOk = ctx.settings.viasAllowed && profile.barrelForms.length > 0;
  return lineProbeRoute(
    ctx.layout, ctx.lattice, ctx.journal, ends.from.pt, ends.to.pt,
    fromUsable, toUsable, viasOk, profile, ignore, lineProbeOptsOf(ctx, deadline),
  );
}

/** Per-connection options for the corner-stitched channel router (`detailed*` caps + abort signal). */
function channelOptsOf(ctx: RouteCtx, deadline: number | undefined): ChannelOptions {
  const dl = ctx.settings.detailedBudgetMs !== undefined
    ? Math.min(deadline ?? Infinity, now() + ctx.settings.detailedBudgetMs)
    : deadline;
  return {
    ...(dl !== undefined && dl !== Infinity ? { deadline: dl } : {}),
    ...(ctx.hooks?.signal ? { signal: ctx.hooks.signal } : {}),
    ...(ctx.settings.detailedMaxTiles !== undefined ? { maxTiles: ctx.settings.detailedMaxTiles } : {}),
  };
}

/** Channel detailed rung (§9b-2): A* over the corner-stitched free tiles of a locked channel. */
function tryChannelRoute(
  ctx: RouteCtx, net: number | null, ends: { from: Endpoint; to: Endpoint },
  fromUsable: number[], toUsable: number[], profile: Profile, ignore: IgnoreSet, deadline: number | undefined,
): boolean {
  const viasOk = ctx.settings.viasAllowed && profile.barrelForms.length > 0;
  return channelRoute(
    ctx.layout, ctx.lattice, ctx.journal, ends.from.pt, ends.to.pt,
    fromUsable, toUsable, viasOk, profile, ignore, channelOptsOf(ctx, deadline),
  );
}

/**
 * Attach a connection to same-net Prior copper (task I7 gap 1; rules/connectivity.md K-16,
 * spec/formats/srj.md J-34). A required connection joins two terminal components; when one of them
 * already holds the net's Prior copper, routing the *other* endpoint to that Prior copper joins the
 * two components and completes the connection. Prior copper is same-net (never blocks its own net in
 * clear.ts) and connective (a Track touching it joins, connect.ts), so the attach leg is short and
 * lands on a large, reachable target. Journalled: a partial attach is rolled back so a failed
 * attempt leaves no dangling copper. Deterministic: components and Pours in ascending id order.
 */
function tryAttachPrior(
  ctx: RouteCtx, conn: Connection, ends: { from: Endpoint; to: Endpoint },
  fromUsable: number[], toUsable: number[], profile: Profile, ignore: IgnoreSet, deadline: number | undefined,
): boolean {
  const net = conn.net;
  if (net === null) return false;
  const cc = ctx.conn;
  if (!cc) return false;
  const nc = cc.nets[net];
  if (!nc) return false;

  // Prior Pours of this net on usable Sheets, grouped by their connectivity component.
  const priorByComp = new Map<number, Pour[]>();
  for (const pour of ctx.layout.pours) {
    if (pour.net !== net || pour.origin !== "prior") continue;
    if (!profile.sheets.includes(pour.sheet)) continue;
    const ci = cc.componentOf.get(pour.id);
    if (ci === undefined) continue;
    (priorByComp.get(ci) ?? priorByComp.set(ci, []).get(ci)!).push(pour);
  }
  if (priorByComp.size === 0) return false;

  const compFrom = cc.componentOf.get(conn.from);
  const compTo = cc.componentOf.get(conn.to);

  // One-way attach: route `src` (an endpoint) to Prior copper already in the partner's component.
  const oneWay = (srcPt: Pt, srcSheets: number[], partnerComp: number | undefined): boolean => {
    if (partnerComp === undefined) return false;
    const pours = priorByComp.get(partnerComp);
    if (!pours || srcSheets.length === 0) return false;
    return routeToPours(ctx, net, srcPt, srcSheets, pours, profile, ignore, deadline);
  };
  if (oneWay(ends.from.pt, fromUsable, compTo)) return true;
  if (oneWay(ends.to.pt, toUsable, compFrom)) return true;

  // Two-way attach: neither endpoint sits on Prior copper. Pick a Prior-only component (largest
  // first, ties by lowest index) and route both endpoints onto it, atomically.
  const candidateComps = [...priorByComp.keys()]
    .filter((ci) => ci !== compFrom && ci !== compTo)
    .sort((a, b) => (priorByComp.get(b)!.length - priorByComp.get(a)!.length) || a - b);
  for (const ci of candidateComps) {
    const pours = priorByComp.get(ci)!;
    const mark = ctx.journal.mark();
    if (routeToPours(ctx, net, ends.from.pt, fromUsable, pours, profile, ignore, deadline)
      && routeToPours(ctx, net, ends.to.pt, toUsable, pours, profile, ignore, deadline)) return true;
    ctx.journal.rewind(mark);
    if (deadline !== undefined && now() > deadline) return false;
    if (abortRequested(ctx)) return false;
  }
  return false;
}

/** Route a source point to any of `pours` (same-net Prior copper), nearest target first. */
function routeToPours(
  ctx: RouteCtx, net: number | null, srcPt: Pt, srcSheets: number[], pours: readonly Pour[],
  profile: Profile, ignore: IgnoreSet, deadline: number | undefined,
): boolean {
  interface Target { sheet: number; pt: Pt; d: number }
  const targets: Target[] = [];
  for (const pour of pours) {
    if (!srcSheets.includes(pour.sheet)) continue;
    const v = nearestVertex(pour.outline, srcPt);
    const c = centroid(pour.outline);
    targets.push({ sheet: pour.sheet, pt: v, d: dist2PtPt(v, srcPt) });
    targets.push({ sheet: pour.sheet, pt: c, d: dist2PtPt(c, srcPt) });
  }
  if (targets.length === 0) return false;
  targets.sort((a, b) => a.d - b.d);
  const soft = ctx.settings.ripupEnabled && ctx.ripupActive;
  const LIMIT = 12;
  for (const t of targets.slice(0, LIMIT)) {
    if (fastProbe(ctx, net, t.sheet, srcPt, t.pt, profile, ignore)) return true;
    if (tryRouteOnSheet(ctx, net, t.sheet, srcPt, t.pt, profile, ignore, deadline, false)) return true;
    if (soft && tryRouteOnSheet(ctx, net, t.sheet, srcPt, t.pt, profile, ignore, deadline, true)) return true;
    if (deadline !== undefined && now() > deadline) return false;
    if (abortRequested(ctx)) return false;
  }
  return false;
}

/**
 * Nudge-and-route on one Sheet: nudge the `free` other-net Tracks blocking the direct leg out of
 * the way (rerouting each), then route the connection there. Journalled rollback on failure.
 */
function tryNudgeRoute(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet, deadline: number | undefined): boolean {
  const reroute: RerouteFn = (vnet, vsheet, vf, vt) => {
    const vp = profileFor(ctx, vnet);
    return tryRouteOnSheet(ctx, vnet, vsheet, vf, vt, vp, ignoreOf(vnet), deadline, false);
  };
  const mark = ctx.journal.mark();
  if (!nudgeClear(ctx.layout, ctx.lattice, ctx.journal, sheet, { a: from, b: to }, profile, ignore, reroute)) return false;
  if (fastProbe(ctx, net, sheet, from, to, profile, ignore)) return true;
  if (tryRouteOnSheet(ctx, net, sheet, from, to, profile, ignore, deadline, false)) return true;
  ctx.journal.rewind(mark);
  return false;
}

/** The shove budget for this connection (spec/api/settings.md `shove*`), in LU. */
function shoveBudget(ctx: RouteCtx, profile: Profile): ShoveBudget {
  const luPerUm = ctx.layout.frame.luPerUm;
  const pitch = (profile.width + profile.maxSpacing) || Math.max(1, Math.round(200 * luPerUm));
  const windowLu = ctx.settings.shoveWindowUm !== undefined
    ? Math.max(1, Math.round(ctx.settings.shoveWindowUm * luPerUm))
    : Math.max(1, Math.round(pitch * 3));
  return { windowLu, maxDepth: ctx.settings.shoveMaxDepth ?? 4, maxMoved: ctx.settings.shoveMaxMoved ?? 12 };
}

/**
 * Shove-and-route on one Sheet: displace the `free` other-net Tracks blocking the direct leg out of
 * the way (each kept whole and DRC-clean, cascading within slack), then route the connection there.
 * Journalled rollback on failure — the shove is a strategy-ladder rung entered before rip-up (§9a).
 */
function tryShoveRoute(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet, deadline: number | undefined): boolean {
  if (!ctx.settings.shoveEnabled) return false;
  // Open a channel for the direct leg (and the two L corners it may pull into) by shoving the
  // movable free Tracks aside — kept whole — then insert.
  if (tryShoveTrail(ctx, net, sheet, [from, to], profile, ignore)) return true;
  // Fall back to opening only the direct leg and letting A* find a route through the widened gap.
  const mark = ctx.journal.mark();
  if (shoveClear(ctx.layout, ctx.lattice, ctx.journal, sheet, { a: from, b: to }, profile, ignore, shoveBudget(ctx, profile))
    && tryRouteOnSheet(ctx, net, sheet, from, to, profile, ignore, deadline, false)) return true;
  ctx.journal.rewind(mark);
  return false;
}

/**
 * Shove every leg of a proposed centre path clear, then insert it. Used in the soft-search commit
 * path to prefer *displacing* movable blockers over ripping and rerouting them (§9a). Returns true
 * only when the whole trail was inserted DRC-clean without ripping; rolls back otherwise.
 */
function tryShoveTrail(ctx: RouteCtx, net: number | null, sheet: number, centre: readonly Pt[], profile: Profile, ignore: IgnoreSet): boolean {
  if (!ctx.settings.shoveEnabled || centre.length < 2) return false;
  const mark = ctx.journal.mark();
  const budget = shoveBudget(ctx, profile);
  for (let i = 1; i < centre.length; i++) {
    if (!shoveClear(ctx.layout, ctx.lattice, ctx.journal, sheet, { a: centre[i - 1]!, b: centre[i]! }, profile, ignore, budget)) { ctx.journal.rewind(mark); return false; }
  }
  if (insertTrail(ctx, net, sheet, centre, profile, ignore)) return true;
  ctx.journal.rewind(mark);
  return false;
}

/** Connect a signal point to a plane Pour: a short stub and a Barrel spanning the plane Sheet. */
function tryPlaneVia(ctx: RouteCtx, net: number | null, sigPt: Pt, sigUsable: number[], planeSheet: number, profile: Profile, ignore: IgnoreSet): boolean {
  const luPerUm = ctx.layout.frame.luPerUm;
  const maxRadius = Math.max(1, Math.round(2000 * luPerUm)); // up to ~2 mm from the pad
  for (const sheet of sigUsable) {
    const drop = dropViaNear(ctx.layout, ctx.lattice, sheet, planeSheet, sigPt, profile, ignore, maxRadius);
    if (!drop) continue;
    const mark = ctx.journal.mark();
    const cand = drop.candidate;
    const lo = Math.min(cand.fromSheet, planeSheet, sheet), hi = Math.max(cand.toSheet, planeSheet, sheet);
    if (!barrelFits(ctx.layout, ctx.lattice, drop.at, cand, profile, ignore).ok) continue;
    ctx.journal.addBarrel({ net, at: drop.at, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
    void lo; void hi;
    if (drop.stub.length >= 2) {
      if (!insertTrail(ctx, net, sheet, drop.stub, profile, ignore)) { ctx.journal.rewind(mark); continue; }
    }
    return true;
  }
  return false;
}

function insertTrail(ctx: RouteCtx, net: number | null, sheet: number, centre: readonly Pt[], profile: Profile, ignore: IgnoreSet): boolean {
  const los = (a: Pt, b: Pt): boolean => sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  const pulled = pullPath(centre, los);
  // Neck-down (Q-I4-65): the legaliser necks a blocked end leg to `profile.neckWidth`; this is a
  // no-op unless `neckWidthUm` is set (then `neckWidth < width`).
  const leg = legaliseTrail(ctx.layout, ctx.lattice, sheet, pulled, profile, ignore, true);
  if (!leg.ok) return false;
  const pieces = trackPieces(leg.pts, leg.widths);
  if (pieces.length === 0) return false;
  for (const piece of pieces) {
    if (piece.pts.length < 2) continue;
    ctx.journal.addTrack({ net, sheet, pts: piece.pts, width: piece.width, kind: profile.trackKind, hold: "free" });
    // PathFinder present-sharing: mark the resource cells this committed leg uses this pass.
    for (let i = 1; i < piece.pts.length; i++) ctx.ripHistory.bumpPresentSeg(sheet, piece.pts[i - 1]!, piece.pts[i]!);
  }
  return true;
}

/** Fast line probes only (Soukup 1978): direct and the two L / staircase corners. No A*. */
function fastProbe(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet): boolean {
  const probes: Pt[][] = [
    [from, to],
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  ];
  for (const probe of probes) if (insertTrail(ctx, net, sheet, probe, profile, ignore)) return true;
  return false;
}

function tryRouteOnSheet(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet, deadline: number | undefined, soft: boolean, corridor?: CorridorGuide): boolean {
  if (!soft && fastProbe(ctx, net, sheet, from, to, profile, ignore)) return true;

  // A* over a lazily built Quilt, coarse first then a finer grid to weave through tighter gaps.
  const cost = sheetCostOf(ctx, sheet);
  const dirs = profile.angleMode === "90" ? DIRS_4 : DIRS_8;
  const stepCost = (d: number): number => {
    const [dx, dy] = dirs[d]!;
    if (dx !== 0 && dy !== 0) return Math.max(cost.along, cost.against);
    if (dy === 0) return cost.preferDir === "h" ? cost.along : cost.preferDir === "v" ? cost.against : cost.along;
    return cost.preferDir === "v" ? cost.along : cost.preferDir === "h" ? cost.against : cost.along;
  };
  const minCost = Math.min(cost.along, cost.against);
  const startRipup = ctx.settings.startRipupCost;
  const edgeCost = (a: Pt, b: Pt): EdgeCost => {
    // Hard mode: the Quilt's node-free gate is enough to *propose* a path; the exact clearance is
    // re-checked by pull + legalise before anything is inserted (docs/DESIGN.md §6, "the Quilt only
    // proposes"). Skipping the per-edge predicate here is the dominant speed-up on large boards.
    if (!soft) return CLEAR_EDGE;
    const r = sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width);
    // SPIKE I17 detailed-negotiation cost (McMurchie & Ebeling 1995), gated on `negHistoryWeight`:
    // every soft edge is priced `startRipup·(present·pw + history·hw)` — the PathFinder resource
    // term applied *whether or not* a blocker is present, so a chronically contested cell stays
    // expensive even in the pass where its blocker was ripped, which is what erases the first-come
    // advantage. The exact predicate still gates every insert, so R-1 is untouched. When
    // `negHistoryWeight` is undefined the legacy branch below runs, so the default path is unchanged.
    const hw = ctx.negHistoryWeight;
    if (hw !== undefined) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const pw = ctx.negPresentWeight ?? 0;
      const congestion = startRipup * (pw * ctx.ripHistory.present(sheet, mid.x, mid.y) + hw * ctx.ripHistory.cell(sheet, mid.x, mid.y));
      if (r.ok) return congestion === 0 ? CLEAR_EDGE : { blocked: false, extra: congestion, rip: [] };
      let base = 0;
      for (const id of r.blocking) {
        if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
        base += startRipup;
      }
      return { blocked: false, extra: base + congestion, rip: r.blocking };
    }
    if (r.ok) return CLEAR_EDGE;
    // Soft: passable only if every blocker is a rippable free other-net item.
    let extra = 0;
    for (const id of r.blocking) {
      if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
      extra += ripCost(startRipup, ctx.ripHistory, id);
    }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    extra += cellHistory(startRipup, ctx.ripHistory, sheet, mid);
    // PathFinder present-sharing: penalise resources already used this pass (McMurchie & Ebeling).
    extra *= presentFactor(ctx.settings.presentCongestionCost, ctx.ripHistory, sheet, mid);
    return { blocked: false, extra, rip: r.blocking };
  };

  const base = gridStep(ctx, profile, from, to);
  for (const div of divsFor(base, from, to)) {
    const step = Math.max(1, Math.floor(base / div));
    const region = gridRegion(ctx, from, to, step);
    if (!region) continue;
    const cells = (region.gx1 - region.gx0 + 1) * (region.gy1 - region.gy0 + 1);
    const quilt = createQuilt(ctx.layout, ctx.lattice, sheet, profile, from, region.step, { ignore });
    // In soft mode a cell blocked only by rippable free other-net copper is still traversable.
    const softCache = new Map<number, boolean>();
    const nodeFree = soft
      ? (gx: number, gy: number): boolean => {
          if (quilt.isFree(gx, gy)) return true;
          const key = (gx + 0x40000) * 0x80000 + (gy + 0x40000);
          const c = softCache.get(key);
          if (c !== undefined) return c;
          const r = pointFree(ctx.layout, ctx.lattice, sheet, quilt.pointOf(gx, gy), profile, ignore, profile.width);
          let ok = r.ok;
          if (!ok) { ok = true; for (const id of r.blocking) if (!isRippable(ctx.layout, ctx.lattice, id, net)) { ok = false; break; } }
          softCache.set(key, ok);
          return ok;
        }
      : (gx: number, gy: number): boolean => quilt.isFree(gx, gy);
    const space: SearchSpace = { step: region.step, pointOf: quilt.pointOf, nodeFree, edgeCost };
    const corridorBias = corridor ? corridorBiasForSheet(corridor, sheet, quilt.pointOf) : undefined;
    const res = aStar(space, {
      start: { gx: 0, gy: 0 },
      goal: quilt.cellOf(to),
      region,
      dirs,
      stepCost,
      minCost,
      bendCost: ctx.settings.bendCost,
      maxPops: Math.min(MAX_POPS, Math.max(4000, cells)),
      ...(deadline !== undefined ? { deadline } : {}),
      ...(ctx.hooks?.signal ? { signal: ctx.hooks.signal } : {}),
      ...(corridorBias ? { corridorBias } : {}),
    });
    if (!res.ok) {
      if (deadline !== undefined && now() > deadline) return false;
      if (abortRequested(ctx)) return false;
      continue;
    }
    const centre = [...res.path, to];
    if (soft && res.rip.length > 0) {
      const budget = perConnRipBudget(ctx);
      if (res.rip.length > budget) continue;
      // Prefer shoving the movable blockers aside (kept whole) over ripping and rerouting them (§9a).
      if (tryShoveTrail(ctx, net, sheet, centre, profile, ignore)) return true;
      const mark = ctx.journal.mark();
      ripAll(ctx, res.rip);
      if (insertTrail(ctx, net, sheet, centre, profile, ignore)) { ctx.ripped += res.rip.length; return true; }
      ctx.journal.rewind(mark); // restores the ripped items
      continue;
    }
    if (insertTrail(ctx, net, sheet, centre, profile, ignore)) return true;
  }
  return false;
}

function perConnRipBudget(ctx: RouteCtx): number {
  void ctx;
  return 30;
}

// ---- multilayer route with Barrel drops -------------------------------------------------------

/**
 * Cross-Sheet route through a single Barrel at one of a few candidate points, each leg routed by
 * the proven single-Sheet router (fast probes then A*). Handles the common two-layer case
 * robustly even when an endpoint sits in a dense pin field. Deterministic candidate order.
 */
function tryRouteViaPoints(
  ctx: RouteCtx, net: number | null, from: Pt, to: Pt,
  fromUsable: number[], toUsable: number[], profile: Profile, ignore: IgnoreSet,
  deadline: number | undefined, soft: boolean,
): boolean {
  const luPerUm = ctx.layout.frame.luPerUm;
  const pitch = Math.max(1, Math.round((profile.width + profile.maxSpacing) * 1.5) || Math.round(200 * luPerUm));
  const cands = viaPointCandidates(from, to, pitch);
  for (const sa of fromUsable) {
    for (const sb of toUsable) {
      if (sa === sb) continue;
      const cand = pickBarrel(profile, sa, sb);
      if (!cand) continue;
      for (const at of cands) {
        if (!barrelFits(ctx.layout, ctx.lattice, at, cand, profile, ignore).ok) continue;
        const mark = ctx.journal.mark();
        ctx.journal.addBarrel({ net, at, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
        const leg1 = tryRouteOnSheet(ctx, net, sa, from, at, profile, ignore, deadline, soft);
        const leg2 = leg1 && tryRouteOnSheet(ctx, net, sb, at, to, profile, ignore, deadline, soft);
        if (leg1 && leg2) return true;
        ctx.journal.rewind(mark);
        if (deadline !== undefined && now() > deadline) return false;
        if (abortRequested(ctx)) return false;
      }
    }
  }
  return false;
}

/**
 * Two-Barrel "jog": leave `sheet` near `from`, cross on another usable Sheet, and return near
 * `to`. Used when the endpoints share a Sheet but it is blocked between them while another Sheet is
 * clear (the classic two-layer detour). Each leg is routed by the single-Sheet router.
 */
function tryRouteViaJog(
  ctx: RouteCtx, net: number | null, from: Pt, to: Pt, sheet: number, profile: Profile,
  ignore: IgnoreSet, deadline: number | undefined, soft: boolean,
): boolean {
  const luPerUm = ctx.layout.frame.luPerUm;
  const pitch = Math.max(1, Math.round((profile.width + profile.maxSpacing) * 1.5) || Math.round(200 * luPerUm));
  const nearFrom = endpointVias(from, to, pitch);
  const nearTo = endpointVias(to, from, pitch);
  for (const other of profile.sheets) {
    if (other === sheet) continue;
    const cand = pickBarrel(profile, sheet, other);
    if (!cand) continue;
    for (const v1 of nearFrom) {
      if (!barrelFits(ctx.layout, ctx.lattice, v1, cand, profile, ignore).ok) continue;
      for (const v2 of nearTo) {
        if (v1.x === v2.x && v1.y === v2.y) continue;
        if (!barrelFits(ctx.layout, ctx.lattice, v2, cand, profile, ignore).ok) continue;
        const mark = ctx.journal.mark();
        ctx.journal.addBarrel({ net, at: v1, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
        ctx.journal.addBarrel({ net, at: v2, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
        const ok = tryRouteOnSheet(ctx, net, sheet, from, v1, profile, ignore, deadline, soft)
          && tryRouteOnSheet(ctx, net, other, v1, v2, profile, ignore, deadline, soft)
          && tryRouteOnSheet(ctx, net, sheet, v2, to, profile, ignore, deadline, soft);
        if (ok) return true;
        ctx.journal.rewind(mark);
        if (deadline !== undefined && now() > deadline) return false;
        if (abortRequested(ctx)) return false;
      }
    }
  }
  return false;
}

/** A few Barrel points just outside `at`, stepped toward `toward` and to its sides. */
function endpointVias(at: Pt, toward: Pt, pitch: number): Pt[] {
  const dx = toward.x - at.x, dy = toward.y - at.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const out: Pt[] = [];
  for (const k of [1, 2, 3]) out.push({ x: Math.round(at.x + ux * pitch * k), y: Math.round(at.y + uy * pitch * k) });
  // Perpendicular escapes at one pitch out then toward.
  out.push({ x: Math.round(at.x - uy * pitch + ux * pitch), y: Math.round(at.y + ux * pitch + uy * pitch) });
  out.push({ x: Math.round(at.x + uy * pitch + ux * pitch), y: Math.round(at.y - ux * pitch + uy * pitch) });
  return out;
}

/** Candidate via points between two endpoints: near each end and the midpoint (kept small for speed). */
function viaPointCandidates(from: Pt, to: Pt, pitch: number): Pt[] {
  const out: Pt[] = [];
  const seen = new Set<string>();
  const push = (p: Pt): void => { const k = `${p.x},${p.y}`; if (!seen.has(k)) { seen.add(k); out.push(p); } };
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  for (const f of [2, 4]) push({ x: Math.round(from.x + ux * pitch * f), y: Math.round(from.y + uy * pitch * f) });
  for (const f of [2, 4]) push({ x: Math.round(to.x - ux * pitch * f), y: Math.round(to.y - uy * pitch * f) });
  push({ x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2) });
  return out;
}

interface LayerCost { along: number; against: number; preferDir: "h" | "v" | null }

/**
 * Route one connection across several usable Sheets, dropping Barrels between them (docs/DESIGN.md
 * §6; spec/rules/vias.md V-06). `fromUsable` / `toUsable` are the endpoints' usable Sheet ids;
 * every usable Sheet of the Profile is a candidate transit layer.
 */
function tryRouteLayered(
  ctx: RouteCtx, net: number | null, from: Pt, to: Pt,
  fromUsable: number[], toUsable: number[], profile: Profile, ignore: IgnoreSet,
  deadline: number | undefined, soft: boolean, corridor?: CorridorGuide,
): boolean {
  const usable = profile.sheets.slice(); // ascending
  if (usable.length < 2 && fromUsable.length && toUsable.length && fromUsable[0] === toUsable[0]) return false;
  const layerOf = new Map<number, number>();
  usable.forEach((s, i) => layerOf.set(s, i));
  const startLayers = fromUsable.map((s) => layerOf.get(s)!).filter((i) => i !== undefined);
  const goalLayers = toUsable.map((s) => layerOf.get(s)!).filter((i) => i !== undefined);
  if (startLayers.length === 0 || goalLayers.length === 0) return false;

  const costs: LayerCost[] = usable.map((s) => sheetCostOf(ctx, s));
  const startRipup = ctx.settings.startRipupCost;
  const viaCost = profile.planeNet ? ctx.settings.planeViaCost : ctx.settings.viaCost;
  // Candidate Barrel per layer pair (undefined when none spans the two Sheets).
  const candMatrix: Array<Array<BarrelCandidate | undefined>> = usable.map((_, i) => usable.map((_2, j) => (i === j ? undefined : pickBarrel(profile, usable[i]!, usable[j]!))));

  const base = gridStep(ctx, profile, from, to);
  for (const div of divsFor(base, from, to)) {
    const step = Math.max(1, Math.floor(base / div));
    const region = gridRegion(ctx, from, to, step);
    if (!region) continue;
    const st = region.step;
    const origin = from;
    const pointOf = (gx: number, gy: number): Pt => ({ x: origin.x + gx * st, y: origin.y + gy * st });
    const cellOf = (p: Pt): { gx: number; gy: number } => ({ gx: Math.round((p.x - origin.x) / st), gy: Math.round((p.y - origin.y) / st) });
    const quilts = usable.map((sid) => createQuilt(ctx.layout, ctx.lattice, sid, profile, origin, st, { ignore }));

    const dirs = profile.angleMode === "90" ? DIRS_4 : DIRS_8;
    const stepCost = (layer: number, d: number): number => {
      const c = costs[layer]!;
      const [dx, dy] = dirs[d]!;
      if (dx !== 0 && dy !== 0) return Math.max(c.along, c.against);
      if (dy === 0) return c.preferDir === "h" ? c.along : c.preferDir === "v" ? c.against : c.along;
      return c.preferDir === "v" ? c.along : c.preferDir === "h" ? c.against : c.along;
    };
    let minCost = Infinity;
    for (const c of costs) minCost = Math.min(minCost, c.along, c.against);
    if (!isFinite(minCost)) minCost = 1;

    const edgeCost = (layer: number, a: Pt, b: Pt): EdgeCost => {
      if (!soft) return CLEAR_EDGE;
      const r = sweepClear(ctx.layout, ctx.lattice, usable[layer]!, { a, b }, profile, ignore, profile.width);
      if (r.ok) return CLEAR_EDGE;
      let extra = 0;
      for (const id of r.blocking) {
        if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
        extra += ripCost(startRipup, ctx.ripHistory, id);
      }
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      extra += cellHistory(startRipup, ctx.ripHistory, usable[layer]!, mid);
      extra *= presentFactor(ctx.settings.presentCongestionCost, ctx.ripHistory, usable[layer]!, mid);
      return { blocked: false, extra, rip: r.blocking };
    };
    const fitCache = new Map<number, boolean>();
    const viaMove = (li: number, lj: number, gx: number, gy: number): { extra: number; rip: readonly number[] } | null => {
      const cand = candMatrix[li]![lj];
      if (!cand) return null;
      const key = (gx * 8192 + gy) * (usable.length * usable.length) + (li * usable.length + lj);
      let ok = fitCache.get(key);
      if (ok === undefined) { ok = barrelFits(ctx.layout, ctx.lattice, pointOf(gx, gy), cand, profile, ignore).ok; fitCache.set(key, ok); }
      if (!ok) return null;
      return { extra: viaCost, rip: [] };
    };

    const nodeFree = soft
      ? (layer: number, gx: number, gy: number): boolean => {
          const q = quilts[layer]!;
          if (q.isFree(gx, gy)) return true;
          const r = pointFree(ctx.layout, ctx.lattice, usable[layer]!, pointOf(gx, gy), profile, ignore, profile.width);
          if (r.ok) return true;
          for (const id of r.blocking) if (!isRippable(ctx.layout, ctx.lattice, id, net)) return false;
          return true;
        }
      : (layer: number, gx: number, gy: number): boolean => quilts[layer]!.isFree(gx, gy);
    const space: LayeredSpace = {
      step: st, layers: usable.length, pointOf,
      nodeFree,
      edgeCost, viaMove,
    };
    const goal = cellOf(to);
    const starts = startLayers.map((layer) => { const c = cellOf(from); return { layer, gx: c.gx, gy: c.gy }; });
    const cells = (region.gx1 - region.gx0 + 1) * (region.gy1 - region.gy0 + 1) * usable.length;
    const reachGoal = (layer: number, gx: number, gy: number): boolean =>
      sweepClear(ctx.layout, ctx.lattice, usable[layer]!, { a: pointOf(gx, gy), b: to }, profile, ignore, profile.width).ok;
    const corridorBias = corridor ? corridorBiasLayered(corridor, usable, pointOf) : undefined;
    const res = aStarLayered(space, {
      starts, goalCell: goal, goalLayers, region, dirs, stepCost, minCost,
      bendCost: ctx.settings.bendCost, viaFloor: viaCost, reachGoal,
      maxPops: Math.min(MAX_POPS, Math.max(6000, cells)),
      ...(deadline !== undefined ? { deadline } : {}),
      ...(ctx.hooks?.signal ? { signal: ctx.hooks.signal } : {}),
      ...(corridorBias ? { corridorBias } : {}),
    });
    if (!res.ok) {
      if (deadline !== undefined && now() > deadline) return false;
      if (abortRequested(ctx)) return false;
      continue;
    }
    if (soft && res.rip.length > 0) {
      const budget = perConnRipBudget(ctx);
      if (res.rip.length > budget) continue;
      const mark = ctx.journal.mark();
      ripAll(ctx, res.rip);
      if (insertLayeredTrail(ctx, net, res.path, usable, to, profile, ignore)) { ctx.ripped += res.rip.length; return true; }
      ctx.journal.rewind(mark);
      continue;
    }
    if (insertLayeredTrail(ctx, net, res.path, usable, to, profile, ignore)) return true;
  }
  return false;
}

/** Turn a layered search path into Barrels and per-Sheet Tracks, all journaled; rollback on any miss. */
function insertLayeredTrail(ctx: RouteCtx, net: number | null, path: ReadonlyArray<{ layer: number; pt: Pt; via: boolean }>, usable: number[], to: Pt, profile: Profile, ignore: IgnoreSet): boolean {
  if (path.length === 0) return false;
  const mark = ctx.journal.mark();
  // Split into same-Sheet legs joined by Barrels.
  interface Leg { sheet: number; pts: Pt[] }
  const legs: Leg[] = [];
  const barrels: Array<{ at: Pt; a: number; b: number }> = [];
  let cur: Leg = { sheet: usable[path[0]!.layer]!, pts: [path[0]!.pt] };
  let prevLayer = path[0]!.layer;
  for (let i = 1; i < path.length; i++) {
    const s = path[i]!;
    if (s.via) {
      barrels.push({ at: s.pt, a: usable[prevLayer]!, b: usable[s.layer]! });
      legs.push(cur);
      cur = { sheet: usable[s.layer]!, pts: [s.pt] };
    } else {
      cur.pts.push(s.pt);
    }
    prevLayer = s.layer;
  }
  // Extend the final leg to the exact target point.
  if (cur.pts.length > 0 && (cur.pts[cur.pts.length - 1]!.x !== to.x || cur.pts[cur.pts.length - 1]!.y !== to.y)) cur.pts.push(to);
  legs.push(cur);

  // Insert Barrels first so the legs treat them as same-net (K-01 joints).
  for (const b of barrels) {
    const cand = pickBarrel(profile, b.a, b.b);
    if (!cand || !barrelFits(ctx.layout, ctx.lattice, b.at, cand, profile, ignore).ok) { ctx.journal.rewind(mark); return false; }
    ctx.journal.addBarrel({ net, at: b.at, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
  }
  for (const leg of legs) {
    if (leg.pts.length < 2) continue;
    if (!insertTrail(ctx, net, leg.sheet, leg.pts, profile, ignore)) { ctx.journal.rewind(mark); return false; }
  }
  return true;
}

/**
 * Grid resolutions to try, coarse first. A third, finer resolution (÷4) is added only for a
 * *local* connection (short span), where weaving through a dense pin field needs it; long
 * connections skip it so the search stays affordable on large boards.
 */
function divsFor(base: number, from: Pt, to: Pt): number[] {
  const span = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  return span <= 40 * base ? [1, 2, 4] : [1, 2];
}

function gridStep(ctx: RouteCtx, profile: Profile, from: Pt, to: Pt): number {
  const luPerUm = ctx.layout.frame.luPerUm;
  let pitch = profile.width + profile.maxSpacing;
  if (pitch < 1) pitch = Math.max(1, Math.round(100 * luPerUm)); // 100 µm fallback
  const span = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  // Keep at least a few grid steps across the connection, without going below the routing pitch.
  return Math.max(1, Math.min(pitch, Math.max(1, Math.floor(span / 2)) || pitch));
}

function gridRegion(ctx: RouteCtx, from: Pt, to: Pt, step: number): { gx0: number; gy0: number; gx1: number; gy1: number; step: number } | undefined {
  const bb: Box = { x0: Math.min(from.x, to.x), y0: Math.min(from.y, to.y), x1: Math.max(from.x, to.x), y1: Math.max(from.y, to.y) };
  const span = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const inflate = Math.max(8 * step, Math.round(0.5 * span));
  let box: Box = { x0: bb.x0 - inflate, y0: bb.y0 - inflate, x1: bb.x1 + inflate, y1: bb.y1 + inflate };
  if (ctx.layout.rim && ctx.layout.rim.outline.length >= 2) {
    const rb = boxOfPts(ctx.layout.rim.outline);
    const pad = step;
    box = {
      x0: Math.max(box.x0, rb.x0 - pad), y0: Math.max(box.y0, rb.y0 - pad),
      x1: Math.min(box.x1, rb.x1 + pad), y1: Math.min(box.y1, rb.y1 + pad),
    };
  }
  // Ensure both endpoints are inside.
  box = {
    x0: Math.min(box.x0, from.x, to.x), y0: Math.min(box.y0, from.y, to.y),
    x1: Math.max(box.x1, from.x, to.x), y1: Math.max(box.y1, from.y, to.y),
  };
  let g = step;
  let gx0 = Math.floor((box.x0 - from.x) / g), gx1 = Math.ceil((box.x1 - from.x) / g);
  let gy0 = Math.floor((box.y0 - from.y) / g), gy1 = Math.ceil((box.y1 - from.y) / g);
  let cells = (gx1 - gx0 + 1) * (gy1 - gy0 + 1);
  while (cells > MAX_REGION_CELLS) {
    g *= 2;
    gx0 = Math.floor((box.x0 - from.x) / g); gx1 = Math.ceil((box.x1 - from.x) / g);
    gy0 = Math.floor((box.y0 - from.y) / g); gy1 = Math.ceil((box.y1 - from.y) / g);
    cells = (gx1 - gx0 + 1) * (gy1 - gy0 + 1);
  }
  if (gx1 <= gx0 || gy1 <= gy0) return undefined;
  return { gx0, gy0, gx1, gy1, step: g };
}

// ---- the pass loop ----------------------------------------------------------------------------

/** Deterministic connection order: by net id, then the net's Kruskal edge order (distance, ids). */
function connectionsOf(ctx: RouteCtx): Connection[] {
  const conn = connectivity(ctx.layout, ctx.lattice);
  ctx.conn = conn;
  const out: Connection[] = [];
  const isPlaneNet = (id: number): boolean => ctx.layout.stack.some((s) => s.role === "plane" && s.planeNet === id);
  for (const net of ctx.layout.nets) {
    if (ctx.ignored.has(net.id)) continue;
    if (ctx.settings.viasAllowed && isPlaneNet(net.id)) {
      const pc = planeConnectionsOf(ctx, conn, net.id);
      if (pc) { out.push(...pc); continue; }
    }
    out.push(...requiredConnectionsOf(conn, net.id));
  }
  return out;
}

/**
 * Order the pass's connections. By default (`orderByDifficulty`) the hardest go first: descending
 * (airline × local congestion), where local congestion is 1 + the connection's accumulated
 * contention (Nair 1987 difficulty-driven ordering). Ties, and the whole order when the setting is
 * off, fall back to the legacy `(net, from, to)` order so the fast tier is deterministic and
 * unchanged. Sorting is stable-keyed, never depending on Map iteration order (docs/DESIGN.md §7).
 */
function orderConnections(ctx: RouteCtx, connections: Connection[], useDifficulty: boolean): Connection[] {
  if (!useDifficulty || !ctx.settings.orderByDifficulty) return connections;
  // Difficulty = airline × local congestion, where local congestion is the connection's observed
  // contention (how often it has failed to route so far). A connection routed cleanly has contention
  // 0, so its difficulty is 0 and it keeps the legacy `(net, id)` order; only connections that are
  // genuinely boxed in rise to the front — a gentle, self-limiting reading of Nair (1987) that does
  // not disturb the boards a greedy order already converges.
  const diff = (c: Connection): number => c.airlineLu * (ctx.contention.get(`${c.net}:${c.from}:${c.to}`) ?? 0);
  // Order at the *net* level (each net's edges kept contiguous, in their legacy Kruskal order) so
  // the difficulty order preserves the per-net routing locality that keeps rip-up churn down while
  // still attempting the hardest nets — long airlines through congested regions — first (Nair 1987).
  const groups = new Map<number, { conns: Connection[]; first: number; d: number }>();
  connections.forEach((c, i) => {
    let g = groups.get(c.net);
    if (!g) { g = { conns: [], first: i, d: 0 }; groups.set(c.net, g); }
    g.conns.push(c);
    if (diff(c) > g.d) g.d = diff(c);
  });
  return [...groups.values()]
    .sort((a, b) => (b.d - a.d) || (a.first - b.first))
    .flatMap((g) => g.conns);
}

/**
 * Plane-net connections (K-07): every non-Pour terminal component is joined to its nearest Pour
 * component; Pour–Pour edges are not attempted. Returns undefined when the net has no Pour
 * component (fall back to the ordinary MST edges).
 */
function planeConnectionsOf(ctx: RouteCtx, conn: ReturnType<typeof connectivity>, netId: number): Connection[] | undefined {
  const nc = conn.nets[netId];
  if (!nc || nc.terminal.length < 2) return undefined;
  const hasPour = (ci: number): boolean => nc.components[ci]!.some((id) => conn.items.get(id)?.cat === "pour");
  const pourComps = nc.terminal.filter(hasPour);
  const otherComps = nc.terminal.filter((ci) => !hasPour(ci));
  if (pourComps.length === 0 || otherComps.length === 0) return undefined;
  const anchor = (ci: number): { p: Pt; id: number } => {
    // A Pad/Barrel centre in the component (lowest id), else the first Pour vertex.
    const ids = nc.components[ci]!;
    for (const id of ids) {
      const it = conn.items.get(id);
      if (!it) continue;
      if (it.cat === "pad") return { p: (it.ref as Pad).at, id };
      if (it.cat === "barrel") return { p: (it.ref as Barrel).at, id };
    }
    for (const id of ids) { const it = conn.items.get(id); if (it?.cat === "pour") return { p: centroid((it.ref as Pour).outline), id }; }
    return { p: { x: 0, y: 0 }, id: ids[0]! };
  };
  const pourAnchors = pourComps.map(anchor);
  const out: Connection[] = [];
  for (const ci of otherComps) {
    const a = anchor(ci);
    let best = pourAnchors[0]!, bestD = Infinity;
    for (const pa of pourAnchors) { const d = dist2PtPt(a.p, pa.p); if (d < bestD) { bestD = d; best = pa; } }
    out.push({ net: netId, from: Math.min(a.id, best.id), to: Math.max(a.id, best.id), airlineLu: Math.sqrt(bestD) });
  }
  return out;
}

// ---- planned driver (task I15, M10c) ----------------------------------------------------------
//
// Under `globalPlan:"plan"` the router first pays the coarse two-phase negotiation (Mesh → Steiner
// → negotiate; commits no copper) and then realises each planned Segment in the Plan's global order
// through the *unchanged* detailed path, guided by its Corridor via `region` + `stepCost`
// (docs/DESIGN.md §10.4; McMurchie & Ebeling 1995 PathFinder; Pan/Xu/Chu 2006–09 FastRoute
// congestion feedback; Nair 1987 difficulty order). Every inserted leg still passes the exact
// `clear.ts` predicate and the Journal, so R-1/R-2/R-6 hold identically to M9; a Corridor can only
// cause a miss, never a Violation. The whole phase is under keep-best and falls back cleanly to the
// legacy local loop (`runPasses` below), so completion can only improve or stay equal.

/** Soft Corridor cost bias: a mild discount for staying inside, a penalty for the margin. */
const CORRIDOR_INSIDE_FACTOR = 0.8;
const CORRIDOR_MARGIN_FACTOR = 1.5;
/** How many Bins to expand the strict Corridor by for the `region` bound (task I16 widened this
 *  from 1: a one-Bin tube choked the detailed search on the dense boards; two Bins lets it detour
 *  around a locally full channel while still confining it to the planned neighbourhood). */
const CORRIDOR_EXPAND_BINS = 2;
/** History added to an unrealisable Corridor's Bridges before re-negotiation (FastRoute feedback). */
const GLOBAL_HISTORY_BUMP = 2;
/**
 * Default cap on global↔detailed feedback ITERATIONS (task I16, M10e). Each iteration rips the whole
 * board's planned copper, re-realises every Segment against the current (escalating-history) Plan,
 * then bumps history on the Bridges of every still-unrealisable Corridor and re-negotiates — so the
 * coarse plan RESPONDS to the detailed failures and drives the detailed router down a *different*
 * corridor next iteration (the PathFinder convergence property; McMurchie & Ebeling 1995,
 * Pan/Xu/Chu 2006–09 FastRoute). `globalMaxIterations`, when set, overrides this cap; the wall-clock
 * `timeBudgetMs` is the real limiter on the dense boards. Bounded either way, so the loop terminates.
 */
const GLOBAL_FEEDBACK_ITERS = 6;

/** Per-Segment Corridor membership over the Mesh, precomputed per Sheet for the detailed search. */
interface CorridorGuide {
  mesh: Mesh;
  /** Per Sheet: packed `(by*nx+bx)` Bin columns strictly inside the Corridor. */
  strict: Map<number, Set<number>>;
  /** Per Sheet: those columns expanded by one Bin — the allowed search region. */
  expanded: Map<number, Set<number>>;
}

/** Build one CorridorGuide per Segment from a negotiated Plan. */
function buildGuides(mesh: Mesh, plan: Plan): Map<number, CorridorGuide> {
  const nx = mesh.nx, ny = mesh.ny;
  const guides = new Map<number, CorridorGuide>();
  for (const seg of plan.segments) {
    const corridor = plan.corridors[seg.id]!;
    const strict = new Map<number, Set<number>>();
    const addStrict = (sheet: number, bx: number, by: number): void => {
      let s = strict.get(sheet);
      if (!s) strict.set(sheet, (s = new Set<number>()));
      s.add(by * nx + bx);
    };
    for (const binId of corridor.bins) { const b = mesh.binAt(binId); addStrict(b.sheet, b.bx, b.by); }
    // Always include the two terminals' Bins so the endpoints stay reachable even when the coarse
    // path seeded from a different candidate Bin or Sheet than the detailed endpoints resolve to.
    for (const t of [seg.from, seg.to]) for (const binId of t.bins) { const b = mesh.binAt(binId); addStrict(b.sheet, b.bx, b.by); }
    const expanded = new Map<number, Set<number>>();
    for (const [sheet, cols] of strict) {
      const e = new Set<number>();
      for (const key of cols) {
        const bx = key % nx, by = Math.floor(key / nx);
        for (let dy = -CORRIDOR_EXPAND_BINS; dy <= CORRIDOR_EXPAND_BINS; dy++) for (let dx = -CORRIDOR_EXPAND_BINS; dx <= CORRIDOR_EXPAND_BINS; dx++) {
          const nbx = bx + dx, nby = by + dy;
          if (nbx < 0 || nbx >= nx || nby < 0 || nby >= ny) continue;
          e.add(nby * nx + nbx);
        }
      }
      expanded.set(sheet, e);
    }
    guides.set(seg.id, { mesh, strict, expanded });
  }
  return guides;
}

/** Single-Sheet Corridor bias over a search grid whose cells map to Pt via `pointOf`. */
function corridorBiasForSheet(guide: CorridorGuide, sheet: number, pointOf: (gx: number, gy: number) => Pt): CorridorBias {
  const mesh = guide.mesh, nx = mesh.nx;
  const strict = guide.strict.get(sheet);
  const exp = guide.expanded.get(sheet);
  const colOf = (gx: number, gy: number): number => {
    const bin = mesh.binOf(sheet, pointOf(gx, gy));
    if (bin < 0) return -1;
    const b = mesh.binAt(bin);
    return b.by * nx + b.bx;
  };
  return {
    outside: (gx, gy) => { if (!exp) return true; const k = colOf(gx, gy); return k < 0 || !exp.has(k); },
    factor: (gx, gy) => { if (!strict) return CORRIDOR_MARGIN_FACTOR; const k = colOf(gx, gy); return k >= 0 && strict.has(k) ? CORRIDOR_INSIDE_FACTOR : CORRIDOR_MARGIN_FACTOR; },
  };
}

/** Layered Corridor bias: `usable[layer]` is the Sheet id of each search layer. */
function corridorBiasLayered(guide: CorridorGuide, usable: readonly number[], pointOf: (gx: number, gy: number) => Pt): LayeredCorridorBias {
  const mesh = guide.mesh, nx = mesh.nx;
  const colOf = (sheet: number, gx: number, gy: number): number => {
    const bin = mesh.binOf(sheet, pointOf(gx, gy));
    if (bin < 0) return -1;
    const b = mesh.binAt(bin);
    return b.by * nx + b.bx;
  };
  return {
    outside: (layer, gx, gy) => { const sheet = usable[layer]!; const exp = guide.expanded.get(sheet); if (!exp) return true; const k = colOf(sheet, gx, gy); return k < 0 || !exp.has(k); },
    factor: (layer, gx, gy) => { const sheet = usable[layer]!; const strict = guide.strict.get(sheet); if (!strict) return CORRIDOR_MARGIN_FACTOR; const k = colOf(sheet, gx, gy); return k >= 0 && strict.has(k) ? CORRIDOR_INSIDE_FACTOR : CORRIDOR_MARGIN_FACTOR; },
  };
}

/** Realise one planned Segment through the detailed path, guided by its Corridor. */
function routeSegmentPlanned(ctx: RouteCtx, seg: Segment, guide: CorridorGuide, soft: boolean): boolean {
  const profile = profileFor(ctx, seg.net);
  const ignore = ignoreOf(seg.net);
  const deadline = perConnDeadlineOf(ctx);
  const inUsable = (s: number): boolean => profile.sheets.includes(s);
  const fromUsable = seg.from.sheets.filter(inUsable);
  const toUsable = seg.to.sheets.filter(inUsable);
  if (fromUsable.length === 0 || toUsable.length === 0) return false;
  const from = seg.from.point, to = seg.to.point;
  const common = fromUsable.filter((s) => toUsable.includes(s)).sort((a, b) => a - b);
  const viasOk = ctx.settings.viasAllowed && profile.barrelForms.length > 0;

  // A clean direct / L probe is a strict win (DRC-clean by construction); take it before the search.
  for (const sheet of common) if (fastProbe(ctx, seg.net, sheet, from, to, profile, ignore)) return true;

  if (!soft) {
    for (const sheet of common) if (tryRouteOnSheet(ctx, seg.net, sheet, from, to, profile, ignore, deadline, false, guide)) return true;
    if (viasOk && tryRouteLayered(ctx, seg.net, from, to, fromUsable, toUsable, profile, ignore, deadline, false, guide)) return true;
    return false;
  }
  if (ctx.settings.ripupEnabled) {
    for (const sheet of common) if (tryRouteOnSheet(ctx, seg.net, sheet, from, to, profile, ignore, deadline, true, guide)) return true;
    if (viasOk && tryRouteLayered(ctx, seg.net, from, to, fromUsable, toUsable, profile, ignore, deadline, true, guide)) return true;
  }
  // M10d: compose the gridless detailed rung inside the Corridor for the locked-channel boards.
  // When `detailedRouter` is on, a Segment the corridor-guided grid/A* still missed falls to the
  // line-search (§9b-1) and the corner-stitched channel router (§9b-2), which thread the sub-Bin
  // channels a coarse Mesh cannot represent (cm5 GND pours, J802 locked copper). Both re-check every
  // leg with the exact predicate and roll back atomically, so R-1/R-2 hold identically (a Corridor
  // still only causes a miss, never a Violation). Only reached under the `tiles`/`lineprobe` setting,
  // so the fast tier and `globalPlan:"off"` are untouched.
  const detailed = ctx.settings.detailedRouter;
  if (detailed === "lineprobe" || detailed === "tiles") {
    const ends = {
      from: { pt: from, sheets: fromUsable, center: from },
      to: { pt: to, sheets: toUsable, center: to },
    };
    if (tryLineprobeRoute(ctx, seg.net, ends, fromUsable, toUsable, profile, ignore, deadline)) return true;
    if (detailed === "tiles" && tryChannelRoute(ctx, seg.net, ends, fromUsable, toUsable, profile, ignore, deadline)) return true;
  }
  return false;
}

/** Global negotiation options (spec/api/settings.md `global*`) with the defaults left in place. */
function negotiateOptsFromSettings(s: RouteSettings): Partial<NegotiateOptions> {
  const o: Partial<NegotiateOptions> = {};
  if (s.globalMaxIterations !== undefined) o.maxIterations = s.globalMaxIterations;
  if (s.globalHistoryWeight !== undefined) o.historyWeight = s.globalHistoryWeight;
  if (s.globalPresentWeight !== undefined) o.presentWeight = s.globalPresentWeight;
  if (s.globalHistoryRamp !== undefined) o.historyRamp = s.globalHistoryRamp;
  if (s.globalLayerBias !== undefined) o.layerBias = s.globalLayerBias;
  return o;
}

/**
 * Realise the current Plan's Segments in global order and return the ids that still missed. A greedy
 * hard-obstacle sweep first (never breaks what it lays), then a rip-up-guided retry of the misses.
 * Every leg still passes the exact `clear.ts` predicate + Journal, so a Corridor causes only a miss.
 */
function realiseAll(ctx: RouteCtx, plan: Plan, byId: readonly Segment[], guides: Map<number, CorridorGuide>): Set<number> {
  const failed = new Set<number>();
  ctx.ripupActive = false;
  ctx.ripHistory.resetPresent();
  for (const segId of plan.order) {
    const seg = byId[segId]!;
    if (ctx.ignored.has(seg.net)) continue;
    if (abortRequested(ctx) || timeUp(ctx)) return failed;
    if (!routeSegmentPlanned(ctx, seg, guides.get(segId)!, false)) failed.add(segId);
  }
  if (ctx.settings.ripupEnabled) {
    // Several rip-up passes over the STILL-incomplete Segments: routing one Segment against soft
    // obstacles rips another net's free copper (negotiated congestion), so a single pass leaves
    // churn behind. Re-checking connectivity each pass and retrying only the truly-incomplete
    // Segments lets the negotiation settle within this iteration (the legacy loop's convergence,
    // applied inside the corridor). Bounded by REALISE_RIPUP_PASSES, so it always terminates.
    for (let pass = 0; pass < REALISE_RIPUP_PASSES; pass++) {
      ctx.ripupActive = true;
      ctx.ripHistory.resetPresent();
      let progressed = false;
      const incomplete = incompleteSegments(ctx, plan, byId);
      for (const segId of plan.order) {
        if (!incomplete.has(segId)) continue;
        if (abortRequested(ctx) || timeUp(ctx)) { for (const s of incomplete) failed.add(s); return prune(ctx, failed, plan, byId); }
        if (routeSegmentPlanned(ctx, byId[segId]!, guides.get(segId)!, true)) progressed = true;
      }
      if (!progressed) break;
    }
  }
  return prune(ctx, failed, plan, byId);
}

/** Max rip-up passes over incomplete Segments within one feedback iteration (bounded convergence). */
const REALISE_RIPUP_PASSES = 3;

/** Segment ids whose two Terminals are not yet in the same connected component (still incomplete). */
function incompleteSegments(ctx: RouteCtx, plan: Plan, byId: readonly Segment[]): Set<number> {
  const conn = connectivity(ctx.layout, ctx.lattice);
  const out = new Set<number>();
  for (const segId of plan.order) {
    const seg = byId[segId]!;
    if (ctx.ignored.has(seg.net)) continue;
    if (!segmentJoined(conn, seg)) out.add(segId);
  }
  return out;
}

/** True when a Segment's two Terminals already sit in the same net component (nothing to route). */
function segmentJoined(conn: Connectivity, seg: Segment): boolean {
  const a = seg.from.anchor, b = seg.to.anchor;
  if (a < 0 || b < 0) return false; // Steiner points have no anchor: treat as unjoined
  const ca = conn.componentOf.get(a), cb = conn.componentOf.get(b);
  return ca !== undefined && ca === cb;
}

/** Recompute the true failure set from live connectivity (drop Segments a later pass completed). */
function prune(ctx: RouteCtx, failed: Set<number>, plan: Plan, byId: readonly Segment[]): Set<number> {
  const inc = incompleteSegments(ctx, plan, byId);
  const out = new Set<number>();
  for (const segId of failed) if (inc.has(segId)) out.add(segId);
  for (const segId of inc) out.add(segId);
  return out;
}

/**
 * The global↔detailed feedback loop (task I16, M10d/M10e; docs/DESIGN.md §10.3–§10.5, §10.7). Builds
 * the Mesh, decomposes each net into 2-pin Segments, negotiates a first congestion-resolved Plan
 * (commits no copper), then ITERATES: rip the whole board's planned copper, re-realise every Segment
 * against the current Plan through the detailed router with corridor guidance, and for every Segment
 * still unrealised bump its Corridor's Bridges' history and RE-NEGOTIATE *keeping* that escalating
 * history — so the coarse plan actually changes and drives the detailed router down a DIFFERENT
 * corridor next iteration (the PathFinder convergence property the M9 local loop and the one-shot
 * M10c plan both lack; McMurchie & Ebeling 1995, Pan/Xu/Chu 2006–09 FastRoute congestion feedback).
 *
 * Whole-board rip-and-reroute each iteration is the property that erases the first-come advantage;
 * it is affordable because the Corridors confine each detailed reroute (docs/DESIGN.md §10.4). The
 * loop is bounded by `globalMaxIterations` (or a small default) and the wall-clock budget, so it
 * always terminates. Keep-best is held as a captured-copper snapshot (not a Journal mark, because
 * the per-iteration whole-board rip rewinds *past* any mark), so the fewest-incomplete DRC-clean
 * state survives the churn (R-6); every recorded state was DRC-clean when laid, so restoring it
 * preserves R-1. Whatever the loop still cannot realise is left for the legacy loop (clean fallback).
 */
function plannedDrive(ctx: RouteCtx): void {
  const conn = connectivity(ctx.layout, ctx.lattice);
  ctx.conn = conn;
  const mesh = buildMesh(ctx.layout, ctx.lattice, ctx.settings.globalBinUm !== undefined ? { binUm: ctx.settings.globalBinUm } : {});
  const segments = steinerDecompose(ctx.layout, mesh, conn);
  if (segments.length === 0) return;
  const byId: Segment[] = [];
  for (const s of segments) byId[s.id] = s;
  const negOpts = negotiateOptsFromSettings(ctx.settings);

  let plan = negotiate(mesh, segments, negOpts);
  let guides = buildGuides(mesh, plan);

  // Whole-board keep-best held as captured copper (docs/DESIGN.md §10.5/§10.6, R-6): `preMark` is the
  // post-fanout, no-planned-copper state; `bestCopper === null` means "just the fanout state".
  const preMark = ctx.journal.mark();
  let bestIncomplete = totalIncomplete(ctx);
  let bestCopper: CopperSnapshot | null = null;
  const record = (): void => {
    const inc = totalIncomplete(ctx);
    if (inc < bestIncomplete) { bestIncomplete = inc; bestCopper = captureCopper(ctx, preMark); }
  };
  const finish = (): void => {
    if (totalIncomplete(ctx) <= bestIncomplete) return;
    ctx.journal.rewind(preMark);
    if (bestCopper) restoreCopper(ctx, bestCopper);
  };

  const maxIters = Math.max(1, ctx.settings.globalMaxIterations ?? GLOBAL_FEEDBACK_ITERS);
  let prevFailed = -1;
  for (let iter = 0; iter < maxIters; iter++) {
    if (abortRequested(ctx) || timeUp(ctx)) break;
    // Whole-board rip: from iteration 1 on, discard all planned copper so every Segment is rerouted
    // against the changed (re-negotiated) cost field — the PathFinder rip-and-reroute-ALL property.
    if (iter > 0) ctx.journal.rewind(preMark);

    const failed = realiseAll(ctx, plan, byId, guides);
    record();

    // Converged (all Segments realised) or out of budget: stop.
    if (failed.size === 0 || abortRequested(ctx) || timeUp(ctx)) break;
    // Fixpoint guard: if the re-negotiation stopped changing the outcome, more iterations cannot
    // help — terminate rather than spin (keeps the loop bounded even below the iteration cap).
    if (failed.size === prevFailed && iter > 0) break;
    prevFailed = failed.size;
    if (iter + 1 >= maxIters || !ctx.settings.ripupEnabled) break;

    // Congestion feedback (FastRoute): bump history on every still-unrealisable Corridor's Bridges,
    // then re-negotiate KEEPING that escalating history so the coarse plan responds to the detailed
    // failures (task I16 crux — see negotiate.ts NegotiateOptions.keepHistory).
    for (const segId of failed) for (const b of plan.corridors[segId]!.bridges) mesh.addHistory(b, GLOBAL_HISTORY_BUMP);
    plan = negotiate(mesh, segments, { ...negOpts, keepHistory: true });
    guides = buildGuides(mesh, plan);
  }

  finish();
}

/**
 * The routing stage entry (docs/DESIGN.md §6). `globalPlan:"off"` (default) runs the M9 local loop
 * unchanged. `globalPlan:"plan"` (M10c) runs the two-phase planned driver, but always against the
 * legacy loop as a baseline and keeps whichever DRC-clean state has the fewer incompletes — so the
 * planned driver's completion can only improve or stay equal, never regress (docs/DESIGN.md §10.4,
 * "clean fallback to the legacy local loop"). The comparison uses a Journal rewind, so both trials
 * run from the same pre-routing state; only an explicit `globalPlan:"plan"` pays the extra trial.
 */
export function runPasses(ctx: RouteCtx): PassOutcome {
  if (!ctx.settings.routerEnabled) return { passes: 0, stoppedBy: "complete", timedOut: false, aborted: false };
  // SPIKE I17: the full detailed negotiated-congestion loop (default off, ignores the R-5 item cap).
  if (ctx.settings.detailedNegotiation === true && ctx.settings.maxItems === undefined) return runDetailedNegotiation(ctx);
  if (ctx.settings.globalPlan === "plan" && ctx.settings.maxItems === undefined) return runPlannedThenBest(ctx);
  return runLegacyPasses(ctx);
}

/**
 * The full detailed negotiated-congestion loop (docs/DESIGN.md §10). This is the property the M4–M9
 * local loop lacks (it reroutes only *incomplete* connections, so an early-completing net holds its
 * resources for ever and the negotiation oscillates then plateaus).
 *
 * Each pass: rewind the board to the post-fanout, no-routing-copper baseline (rip ALL), then route
 * ALL required connections in detail in a negotiation order (Nair 1987 difficulty) against the soft
 * cost `startRipup·(present·pw + history·hw)` (McMurchie & Ebeling 1995 present + history terms). The
 * present map is reset each pass and accrues as this pass's copper is committed; the history map
 * accrues across passes on the resource cells that rips and unroutable corridors touch, and `hw` is
 * escalated per pass. Keep-best snapshot of the fewest-incomplete state. Every insert still passes
 * the exact `sweepClear`/`barrelFits` predicate through the Journal, so R-1/R-2 hold identically to
 * the local loop — a congested corridor can only leave a connection incomplete, never add a
 * violation. `detailedNegotiation:false` (the default) never enters here.
 */
function runDetailedNegotiation(ctx: RouteCtx): PassOutcome {
  const mark0 = ctx.journal.mark();      // post-fanout baseline (no routing copper)
  ctx.ripHistory.reset();                // a fresh negotiation
  ctx.negPresentWeight = ctx.settings.globalPresentWeight ?? DN_PRESENT_WEIGHT;
  const hw0 = ctx.settings.globalHistoryWeight ?? DN_HISTORY_BASE;
  const ramp = ctx.settings.globalHistoryRamp ?? DN_HISTORY_RAMP;

  let passes = 0, stagnant = 0;
  let stoppedBy: RouteReportStop = "maxPasses";
  let timedOut = false, aborted = false;
  let bestIncomplete = Infinity;
  let bestCopper: CopperSnapshot | null = null;

  for (let pass = 0; pass < ctx.settings.maxPasses; pass++) {
    if (abortRequested(ctx)) { aborted = true; stoppedBy = "abort"; break; }
    if (timeUp(ctx)) { timedOut = true; stoppedBy = "timeBudget"; break; }

    // Rip ALL routing copper: back to the post-fanout empty board so every connection is rerouted
    // against the changed (re-negotiated) cost field — the PathFinder rip-and-reroute-ALL property.
    ctx.journal.rewind(mark0);
    ctx.ripHistory.resetPresent();
    ctx.ripupActive = true;
    ctx.negHistoryWeight = hw0 + pass * ramp;   // escalate the history weight per pass
    passes++;

    const connections = orderConnections(ctx, connectionsOf(ctx), true);
    for (const conn of connections) {
      if (abortRequested(ctx)) { aborted = true; stoppedBy = "abort"; break; }
      if (timeUp(ctx)) { timedOut = true; stoppedBy = "timeBudget"; break; }
      const t0 = now();
      ctx.attempted++;
      const cm = ctx.journal.mark();
      const ok = routeConnection(ctx, conn);
      if (ok) {
        ctx.completed++;
        // Present-sharing: bump the cells this connection's copper used so later routes this pass
        // spread off them (the within-pass PathFinder present term).
        for (const id of ctx.journal.insertedSince(cm)) {
          const e = ctx.lattice.itemOf(id);
          if (e?.cat === "track") {
            const t = e.item as Track;
            for (let i = 1; i < t.pts.length; i++) ctx.ripHistory.bumpPresentSeg(t.sheet, t.pts[i - 1]!, t.pts[i]!);
          }
        }
      } else {
        const ck = `${conn.net}:${conn.from}:${conn.to}`;
        ctx.contention.set(ck, (ctx.contention.get(ck) ?? 0) + 1);
        // FastRoute-style congestion feedback: make the corridor this connection could not cross
        // expensive (history, across passes) so other nets vacate it next pass and free room.
        const ends = resolveEndpoints(ctx.layout, conn.from, conn.to);
        if (ends) {
          const s = (ends.from.sheets[0] ?? ends.to.sheets[0]);
          if (s !== undefined) ctx.ripHistory.bumpSeg(s, ends.from.pt, ends.to.pt);
        }
      }
      const netName = ctx.layout.nets.find((n) => n.id === conn.net)?.name ?? String(conn.net);
      ctx.hooks?.onConnection?.({ net: netName, from: String(conn.from), to: String(conn.to), ok, elapsedMs: now() - t0 });
    }

    const inc = totalIncomplete(ctx);
    if (inc < bestIncomplete) { bestIncomplete = inc; bestCopper = captureCopper(ctx, mark0); stagnant = 0; }
    else stagnant++;
    ctx.hooks?.onPass?.({ pass: passes, incomplete: inc, elapsedMs: now() - ctx.startMs });

    if (inc === 0) { stoppedBy = "complete"; break; }
    if (timedOut || aborted) break;
    if (ctx.settings.maxStagnantPasses > 0 && stagnant >= ctx.settings.maxStagnantPasses) { stoppedBy = "stagnant"; break; }
  }

  // Keep-best: restore the fewest-incomplete DRC-clean state seen (R-6).
  ctx.journal.rewind(mark0);
  if (bestCopper) restoreCopper(ctx, bestCopper);
  ctx.negHistoryWeight = undefined;
  ctx.negPresentWeight = undefined;
  return { passes, stoppedBy, timedOut, aborted };
}

/** Snapshot of the per-run counters that a routing trial accumulates (reset between keep-better trials). */
interface CounterSnapshot { completed: number; attempted: number; ripped: number; contention: Map<string, number> }
function snapCounters(ctx: RouteCtx): CounterSnapshot {
  return { completed: ctx.completed, attempted: ctx.attempted, ripped: ctx.ripped, contention: new Map(ctx.contention) };
}
function restoreCounters(ctx: RouteCtx, s: CounterSnapshot): void {
  ctx.completed = s.completed; ctx.attempted = s.attempted; ctx.ripped = s.ripped;
  ctx.contention = new Map(s.contention);
}

/** A router-inserted-copper snapshot: the plain Track/Barrel data added since a Journal mark. */
interface CopperSnapshot { tracks: Array<Omit<Track, "id" | "origin">>; barrels: Array<Omit<Barrel, "id" | "origin">> }
/** Capture the router copper added since `mark` (deep enough to re-insert), by Journal insertion id. */
function captureCopper(ctx: RouteCtx, mark: ReturnType<Journal["mark"]>): CopperSnapshot {
  const ids = new Set(ctx.journal.insertedSince(mark));
  const tracks: Array<Omit<Track, "id" | "origin">> = [];
  const barrels: Array<Omit<Barrel, "id" | "origin">> = [];
  for (const t of ctx.layout.tracks) if (ids.has(t.id)) tracks.push({ net: t.net, sheet: t.sheet, pts: t.pts.map((p) => ({ x: p.x, y: p.y })), width: t.width, kind: t.kind, hold: t.hold });
  for (const b of ctx.layout.barrels) if (ids.has(b.id)) barrels.push({ net: b.net, at: { x: b.at.x, y: b.at.y }, form: b.form, fromSheet: b.fromSheet, toSheet: b.toSheet, kind: b.kind, hold: b.hold });
  return { tracks, barrels };
}
/** Re-insert a captured copper snapshot through the Journal (restoring a known DRC-clean state). */
function restoreCopper(ctx: RouteCtx, snap: CopperSnapshot): void {
  for (const b of snap.barrels) ctx.journal.addBarrel(b);
  for (const t of snap.tracks) ctx.journal.addTrack(t);
}

/**
 * Run the planned driver and keep it only when it does not regress completion (docs/DESIGN.md
 * §10.4). Both trials start from the same pre-routing Journal state. The legacy loop is the
 * guaranteed floor: its result is captured as copper so it can be *restored without re-running* —
 * essential under a time budget, where a redo would have no time left. Every kept state is
 * DRC-clean, so R-1/R-2/R-6 hold whichever trial wins.
 */
function runPlannedThenBest(ctx: RouteCtx): PassOutcome {
  const mark0 = ctx.journal.mark();
  const base = snapCounters(ctx);

  // Baseline trial: the legacy local loop (the completion floor the planned driver must not regress).
  ctx.ripHistory.reset();
  const legacyOutcome = runLegacyPasses(ctx);
  const incLegacy = totalIncomplete(ctx);
  if (incLegacy === 0 || legacyOutcome.aborted) return legacyOutcome;
  const legacyCopper = captureCopper(ctx, mark0);
  const legacyCounters = snapCounters(ctx);

  // Planned trial: from the same start, pay the coarse negotiation and lay corridor-guided copper,
  // then run the legacy loop as the clean fallback for whatever the plan could not realise.
  ctx.journal.rewind(mark0);
  restoreCounters(ctx, base);
  ctx.ripHistory.reset();
  if (!abortRequested(ctx) && !timeUp(ctx)) plannedDrive(ctx);
  const plannedOutcome = runLegacyPasses(ctx);
  const incPlanned = totalIncomplete(ctx);
  if (incPlanned <= incLegacy) return plannedOutcome;

  // Planned regressed: restore the captured legacy result (no re-run, so a spent budget cannot lose
  // it). The restored copper was DRC-clean when first laid, so re-inserting it preserves R-1.
  ctx.journal.rewind(mark0);
  restoreCopper(ctx, legacyCopper);
  restoreCounters(ctx, legacyCounters);
  return legacyOutcome;
}

function runLegacyPasses(ctx: RouteCtx): PassOutcome {
  const maxItems = ctx.settings.maxItems;
  let passes = 0;
  let stagnant = 0;
  let stoppedBy: RouteReportStop = "maxPasses";
  let timedOut = false;
  let aborted = false;

  // Keep-best (negotiated congestion can churn): remember the Journal position of the fewest
  // incompletes seen, and roll back to it if later passes end up worse. Every recorded state was
  // DRC-clean (R-1) when reached, so restoring it preserves R-1.
  let bestIncomplete = Infinity;
  let bestMark = ctx.journal.mark();
  // Difficulty ordering (Nair 1987) is a *rescue*: the passes converge in the legacy order first, so
  // a board a greedy order already routes well is untouched; only once that order stalls
  // (stagnation) does the hardest-first difficulty order get a bounded window to try again. Combined
  // with keep-best rollback below, a difficulty-ordered rescue can only match or improve the legacy
  // result — never regress it (docs/DESIGN.md §9a; task I8 no-regression requirement).
  let rescueMode = false;
  const key = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;

  for (let pass = 0; pass < ctx.settings.maxPasses; pass++) {
    if (abortRequested(ctx)) { aborted = true; stoppedBy = "abort"; break; }
    if (timeUp(ctx)) { timedOut = true; stoppedBy = "timeBudget"; break; }

    const connections = orderConnections(ctx, connectionsOf(ctx), rescueMode && pass > 0);
    const cur = connections.length;
    // "Progress" is a drop in the fewest-incomplete seen (settings.md): negotiated congestion can
    // re-complete ripped nets every pass without ever improving, so counting Track insertions would
    // never stagnate. Keep-best rolls back to `bestMark` if later churn ends up worse.
    if (cur < bestIncomplete) { bestIncomplete = cur; bestMark = ctx.journal.mark(); stagnant = 0; }
    else stagnant++;
    if (cur === 0) { stoppedBy = "complete"; break; }
    if (ctx.settings.maxStagnantPasses > 0 && stagnant >= ctx.settings.maxStagnantPasses) {
      // First stall on a still-congested board: switch on the difficulty-ordered rescue and grant it
      // a fresh stagnation window. Boards that already routed well (few incompletes left) skip the
      // rescue, so the fast tier — small boards that stall with little left — keeps its timing.
      if (ctx.settings.orderByDifficulty && !rescueMode && bestIncomplete >= RESCUE_MIN_INCOMPLETE) { rescueMode = true; stagnant = 0; }
      else { stoppedBy = "stagnant"; break; }
    }

    // Pass 0 is a stabilising greedy pass (hard obstacles + vias, no rip-up), so it never breaks
    // what it lays; rip-up negotiation runs from pass 1 on. Keep-best (above) guards later churn.
    ctx.ripupActive = pass > 0;
    // PathFinder present sharing is a within-pass term: clear it at the start of every pass.
    ctx.ripHistory.resetPresent();

    passes++;
    let completedThisPass = 0;
    const done = new Map<string, boolean>();

    for (const conn of connections) {
      if (abortRequested(ctx)) { aborted = true; stoppedBy = "abort"; break; }
      if (timeUp(ctx)) { timedOut = true; stoppedBy = "timeBudget"; break; }
      if (maxItems !== undefined && addedItems(ctx) >= maxItems) { stoppedBy = "maxItems"; break; }
      if (done.get(key(conn.from, conn.to))) continue;

      const t0 = now();
      ctx.attempted++;
      // R-5: `maxItems` bounds inserted Tracks plus Barrels; a connection whose copper would push
      // the total over the cap is undone (a later, cheaper connection may still fit).
      const capMark = maxItems !== undefined ? ctx.journal.mark() : undefined;
      const ok = routeConnection(ctx, conn);
      if (ok && maxItems !== undefined && addedItems(ctx) > maxItems) {
        ctx.journal.rewind(capMark!);
        stoppedBy = "maxItems";
        continue;
      }
      if (ok) {
        ctx.completed++;
        completedThisPass++;
        done.set(key(conn.from, conn.to), true);
      } else {
        // A connection that fails to route is a locally congested one; bump its contention so the
        // difficulty order (Nair 1987) attempts it earlier next pass, ahead of easier neighbours.
        const ck = `${conn.net}:${conn.from}:${conn.to}`;
        ctx.contention.set(ck, (ctx.contention.get(ck) ?? 0) + 1);
      }
      const netName = ctx.layout.nets.find((n) => n.id === conn.net)?.name ?? String(conn.net);
      ctx.hooks?.onConnection?.({ net: netName, from: String(conn.from), to: String(conn.to), ok, elapsedMs: now() - t0 });
    }

    ctx.hooks?.onPass?.({ pass: passes, incomplete: cur - completedThisPass, elapsedMs: now() - ctx.startMs });
    ctx.hooks?.onProgress?.({ done: ctx.completed, total: ctx.completed + (cur - completedThisPass), elapsedMs: now() - ctx.startMs });

    void completedThisPass;
    if (timedOut || aborted || stoppedBy === "maxItems") break;
  }

  // Roll back to the best state if the current one is worse (churn or a bad final pass).
  const finalIncomplete = connectionsOf(ctx).length;
  if (finalIncomplete > bestIncomplete && maxItems === undefined) ctx.journal.rewind(bestMark);

  return { passes, stoppedBy, timedOut, aborted };
}

/** Build a fresh RouteCtx over `layout` with a live Lattice and Journal. */
export function createCtx(layout: Layout, settings: RouteSettings, hooks?: RouteHooks): RouteCtx {
  const lattice = buildLattice(layout);
  const journal = createJournal(layout, lattice);
  const startMs = now();
  const deadline = settings.timeBudgetMs !== undefined ? startMs + settings.timeBudgetMs : undefined;
  return {
    layout, lattice, journal, settings, hooks,
    ripHistory: createRipupHistory(Math.max(1, Math.round(500 * layout.frame.luPerUm))),
    ignored: ignoredNets(layout, settings.ignoreNetGroups.length ? settings.ignoreNetGroups : undefined),
    startMs,
    deadline,
    baseItems: layout.tracks.length + layout.barrels.length,
    ripupActive: false,
    completed: 0,
    attempted: 0,
    ripped: 0,
    profiles: new Map(),
    preferDir: defaultPreferDirs(layout),
    planeSheets: new Set(layout.stack.filter((s) => s.role === "plane").map((s) => s.id)),
    contention: new Map(),
  };
}

/** Sum of incomplete required connections over non-ignored nets (for report bookkeeping). */
export function totalIncomplete(ctx: RouteCtx): number {
  const conn = connectivity(ctx.layout, ctx.lattice);
  let sum = 0;
  for (const net of ctx.layout.nets) {
    if (ctx.ignored.has(net.id)) continue;
    sum += incompleteCount(conn, net.id);
  }
  return sum;
}

/** Per-net incomplete counts for nets that had at least one required connection at load. */
export function perNetIncomplete(ctx: RouteCtx, seededNets: ReadonlySet<number>): Array<{ net: string; incomplete: number }> {
  const conn = connectivity(ctx.layout, ctx.lattice);
  const out: Array<{ net: string; incomplete: number }> = [];
  for (const net of ctx.layout.nets) {
    if (!seededNets.has(net.id)) continue;
    out.push({ net: net.name, incomplete: incompleteCount(conn, net.id) });
  }
  return out;
}
