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
import { connectivity, incompleteCount, ignoredNets, requiredConnectionsOf } from "../drc/index.ts";
import type { Connection } from "../../spec/types/results.ts";
import { barrelSheets, buildLattice, type Lattice } from "../lattice/index.ts";
import { createJournal, type Journal } from "./journal.ts";
import { resolveProfile, type Profile } from "./profile.ts";
import { ignoreOf, pointFree, sweepClear, type IgnoreSet } from "./clear.ts";
import { createQuilt } from "./quilt.ts";
import { aStar, aStarLayered, DIRS_4, DIRS_8, type EdgeCost, type LayeredSpace, type SearchSpace } from "./search.ts";
import { pullPath } from "./pull.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { createRipupHistory, isRippable, ripCost, cellHistory, type RipupHistory } from "./ripup.ts";
import type { Track } from "../../spec/types/layout.ts";
import { barrelFits } from "./clear.ts";
import { pickBarrel, dropViaNear } from "./via.ts";
import { nudgeClear, type RerouteFn } from "./nudge.ts";
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
  // 3) Negotiated-congestion rip-up (soft obstacles), then local nudge.
  if (ctx.settings.ripupEnabled && ctx.ripupActive) {
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

function tryRouteOnSheet(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet, deadline: number | undefined, soft: boolean): boolean {
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
    if (!soft) return { blocked: false, extra: 0, rip: [] };
    const r = sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width);
    if (r.ok) return { blocked: false, extra: 0, rip: [] };
    // Soft: passable only if every blocker is a rippable free other-net item.
    let extra = 0;
    for (const id of r.blocking) {
      if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
      extra += ripCost(startRipup, ctx.ripHistory, id);
    }
    extra += cellHistory(startRipup, ctx.ripHistory, sheet, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
  deadline: number | undefined, soft: boolean,
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
      if (!soft) return { blocked: false, extra: 0, rip: [] };
      const r = sweepClear(ctx.layout, ctx.lattice, usable[layer]!, { a, b }, profile, ignore, profile.width);
      if (r.ok) return { blocked: false, extra: 0, rip: [] };
      let extra = 0;
      for (const id of r.blocking) {
        if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
        extra += ripCost(startRipup, ctx.ripHistory, id);
      }
      extra += cellHistory(startRipup, ctx.ripHistory, usable[layer]!, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
    const res = aStarLayered(space, {
      starts, goalCell: goal, goalLayers, region, dirs, stepCost, minCost,
      bendCost: ctx.settings.bendCost, viaFloor: viaCost, reachGoal,
      maxPops: Math.min(MAX_POPS, Math.max(6000, cells)),
      ...(deadline !== undefined ? { deadline } : {}),
      ...(ctx.hooks?.signal ? { signal: ctx.hooks.signal } : {}),
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

export function runPasses(ctx: RouteCtx): PassOutcome {
  const maxItems = ctx.settings.maxItems;
  let passes = 0;
  let stagnant = 0;
  let stoppedBy: RouteReportStop = "maxPasses";
  let timedOut = false;
  let aborted = false;

  if (!ctx.settings.routerEnabled) return { passes: 0, stoppedBy: "complete", timedOut: false, aborted: false };

  // Keep-best (negotiated congestion can churn): remember the Journal position of the fewest
  // incompletes seen, and roll back to it if later passes end up worse. Every recorded state was
  // DRC-clean (R-1) when reached, so restoring it preserves R-1.
  let bestIncomplete = Infinity;
  let bestMark = ctx.journal.mark();
  const key = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;

  for (let pass = 0; pass < ctx.settings.maxPasses; pass++) {
    if (abortRequested(ctx)) { aborted = true; stoppedBy = "abort"; break; }
    if (timeUp(ctx)) { timedOut = true; stoppedBy = "timeBudget"; break; }

    const connections = connectionsOf(ctx);
    const cur = connections.length;
    // "Progress" is a drop in the fewest-incomplete seen (settings.md): negotiated congestion can
    // re-complete ripped nets every pass without ever improving, so counting Track insertions would
    // never stagnate. Keep-best rolls back to `bestMark` if later churn ends up worse.
    if (cur < bestIncomplete) { bestIncomplete = cur; bestMark = ctx.journal.mark(); stagnant = 0; }
    else stagnant++;
    if (cur === 0) { stoppedBy = "complete"; break; }
    if (ctx.settings.maxStagnantPasses > 0 && stagnant >= ctx.settings.maxStagnantPasses) { stoppedBy = "stagnant"; break; }

    // Pass 0 is a stabilising greedy pass (hard obstacles + vias, no rip-up), so it never breaks
    // what it lays; rip-up negotiation runs from pass 1 on. Keep-best (above) guards later churn.
    ctx.ripupActive = pass > 0;

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
