/**
 * Passes — the routing stage: an ordered queue of the Layout's incomplete required connections
 * swept over `maxPasses` passes, with stagnation / item-count / time / abort stops (docs/DESIGN.md
 * §6 `passes.ts`, §7). For one connection it resolves a Profile (src/route/profile.ts), picks a
 * shared usable Sheet, tries fast line probes then A* over a lazily built Quilt (Hart et al. 1968;
 * this milestone routes each connection on a single Sheet — `viasAllowed: false` semantics —
 * carrying the `(sheet, patch)` state so I5 can add Barrel moves), string-pulls (Nash et al. 2007)
 * and legalises the Trail with exact `sweepClear` checks, and inserts through the Journal. On a
 * hard failure it re-runs with negotiated-congestion soft obstacles (McMurchie & Ebeling 1995) and
 * rips the winning path's `free` other-net copper. Determinism (docs/DESIGN.md §7): connections in
 * a fixed `(net, distance, id)` order, fixed Sheet order, sequence-tie-broken heap.
 *
 * Nothing is inserted unless every leg passed the exact clearance predicate, so router-added
 * violations are zero by construction (contract R-1); `held` / `locked` items are never touched
 * (R-2); one Track is inserted per completed connection so `added ≤ completed ≤ maxItems` (R-5).
 *
 * Public surface: RouteCtx, PassOutcome, routeConnection, runPasses.
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
import { ignoreOf, sweepClear, type IgnoreSet } from "./clear.ts";
import { createQuilt } from "./quilt.ts";
import { aStar, DIRS_4, DIRS_8, type EdgeCost, type SearchSpace } from "./search.ts";
import { pullPath } from "./pull.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { createRipupHistory, isRippable, ripCost, type RipupHistory } from "./ripup.ts";

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
  /** Completed-connection tally (bounded by `maxItems`). */
  completed: number;
  /** Distinct connection attempts made across all passes. */
  attempted: number;
  ripped: number;
  profiles: Map<number | null, Profile>;
  /** Default preferred direction per Sheet id (settings.md), computed once. */
  preferDir: Map<number, "h" | "v" | null>;
}

export interface PassOutcome {
  passes: number;
  stoppedBy: RouteReportStop;
  timedOut: boolean;
  aborted: boolean;
}

type RouteReportStop = "complete" | "maxPasses" | "stagnant" | "maxItems" | "timeBudget" | "abort";

const MAX_REGION_CELLS = 220_000;
const MAX_POPS = 200_000;

function now(): number { return Date.now(); }

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

/** Try to complete one connection; returns true when copper was inserted. */
export function routeConnection(ctx: RouteCtx, conn: Connection): boolean {
  const ends = resolveEndpoints(ctx.layout, conn.from, conn.to);
  if (!ends) return false;
  const profile = profileFor(ctx, conn.net);
  const ignore = ignoreOf(conn.net);
  const sheets = intersect(ends.from.sheets, ends.to.sheets, profile.sheets);
  if (sheets.length === 0) return false; // needs a Barrel (different Sheets) — deferred to I5

  const perConnDeadline = ctx.settings.connectionBudgetMs !== undefined
    ? Math.min(ctx.deadline ?? Infinity, now() + ctx.settings.connectionBudgetMs)
    : ctx.deadline;

  for (const sheet of sheets) {
    if (tryRouteOnSheet(ctx, conn.net, sheet, ends.from.pt, ends.to.pt, profile, ignore, perConnDeadline, false)) return true;
  }
  // Negotiated-congestion fallback with rip-up, on the first shared Sheet only.
  if (ctx.settings.ripupEnabled && sheets.length > 0) {
    if (tryRouteOnSheet(ctx, conn.net, sheets[0]!, ends.from.pt, ends.to.pt, profile, ignore, perConnDeadline, true)) return true;
  }
  return false;
}

function intersect(a: readonly number[], b: readonly number[], c: readonly number[]): number[] {
  const bs = new Set(b), cs = new Set(c);
  return [...new Set(a.filter((x) => bs.has(x) && cs.has(x)))].sort((x, y) => x - y);
}

function insertTrail(ctx: RouteCtx, net: number | null, sheet: number, centre: readonly Pt[], profile: Profile, ignore: IgnoreSet): boolean {
  const los = (a: Pt, b: Pt): boolean => sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  const pulled = pullPath(centre, los);
  const leg = legaliseTrail(ctx.layout, ctx.lattice, sheet, pulled, profile, ignore, false);
  if (!leg.ok) return false;
  const pieces = trackPieces(leg.pts, leg.widths);
  if (pieces.length === 0) return false;
  for (const piece of pieces) {
    if (piece.pts.length < 2) continue;
    ctx.journal.addTrack({ net, sheet, pts: piece.pts, width: piece.width, kind: profile.trackKind, hold: "free" });
  }
  return true;
}

function tryRouteOnSheet(ctx: RouteCtx, net: number | null, sheet: number, from: Pt, to: Pt, profile: Profile, ignore: IgnoreSet, deadline: number | undefined, soft: boolean): boolean {
  if (!soft) {
    // Fast line probes first (Soukup 1978): direct and the two L / staircase corners.
    const probes: Pt[][] = [
      [from, to],
      [from, { x: to.x, y: from.y }, to],
      [from, { x: from.x, y: to.y }, to],
    ];
    for (const probe of probes) {
      if (insertTrail(ctx, net, sheet, probe, profile, ignore)) return true;
    }
  }

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
    const r = sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width);
    if (r.ok) return { blocked: false, extra: 0, rip: [] };
    if (!soft) return { blocked: true, extra: 0, rip: [] };
    // Soft: passable only if every blocker is a rippable free other-net item.
    let extra = 0;
    for (const id of r.blocking) {
      if (!isRippable(ctx.layout, ctx.lattice, id, net)) return { blocked: true, extra: 0, rip: [] };
      extra += ripCost(startRipup, ctx.ripHistory, id);
    }
    return { blocked: false, extra, rip: r.blocking };
  };

  const base = gridStep(ctx, profile, from, to);
  for (const div of [1, 2]) {
    const step = Math.max(1, Math.floor(base / div));
    const region = gridRegion(ctx, from, to, step);
    if (!region) continue;
    const cells = (region.gx1 - region.gx0 + 1) * (region.gy1 - region.gy0 + 1);
    const quilt = createQuilt(ctx.layout, ctx.lattice, sheet, profile, from, region.step, { ignore });
    const space: SearchSpace = { step: region.step, pointOf: quilt.pointOf, nodeFree: (gx, gy) => quilt.isFree(gx, gy), edgeCost };
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
      for (const id of res.rip) { ctx.journal.remove(id); ctx.ripHistory.bump(id); }
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
  return 8;
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
  for (const net of ctx.layout.nets) {
    if (ctx.ignored.has(net.id)) continue;
    out.push(...requiredConnectionsOf(conn, net.id));
  }
  return out;
}

export function runPasses(ctx: RouteCtx): PassOutcome {
  const maxItems = ctx.settings.maxItems;
  let passes = 0;
  let stagnant = 0;
  let stoppedBy: RouteReportStop = "maxPasses";

  if (!ctx.settings.routerEnabled) return { passes: 0, stoppedBy: "complete", timedOut: false, aborted: false };

  for (let pass = 0; pass < ctx.settings.maxPasses; pass++) {
    if (abortRequested(ctx)) return { passes, stoppedBy: "abort", timedOut: false, aborted: true };
    if (timeUp(ctx)) return { passes, stoppedBy: "timeBudget", timedOut: true, aborted: false };

    // Recompute connectivity fresh each pass, but skip the query when the Lattice was untouched.
    const connections = connectionsOf(ctx);
    if (connections.length === 0) { stoppedBy = "complete"; break; }

    passes++;
    let completedThisPass = 0;
    // Union-find over the pass's components so a connection already realised by an earlier
    // insertion this pass is skipped without a full re-analysis.
    const done = new Map<string, boolean>();
    const key = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;

    for (const conn of connections) {
      if (abortRequested(ctx)) return { passes, stoppedBy: "abort", timedOut: false, aborted: true };
      if (timeUp(ctx)) return { passes, stoppedBy: "timeBudget", timedOut: true, aborted: false };
      if (maxItems !== undefined && ctx.completed >= maxItems) { stoppedBy = "maxItems"; return { passes, stoppedBy, timedOut: false, aborted: false }; }
      if (done.get(key(conn.from, conn.to))) continue;

      const t0 = now();
      ctx.attempted++;
      const ok = routeConnection(ctx, conn);
      if (ok) {
        ctx.completed++;
        completedThisPass++;
        done.set(key(conn.from, conn.to), true);
      }
      const netName = ctx.layout.nets.find((n) => n.id === conn.net)?.name ?? String(conn.net);
      ctx.hooks?.onConnection?.({ net: netName, from: String(conn.from), to: String(conn.to), ok, elapsedMs: now() - t0 });
    }

    ctx.hooks?.onPass?.({ pass: passes, incomplete: connections.length - completedThisPass, elapsedMs: now() - ctx.startMs });
    ctx.hooks?.onProgress?.({ done: ctx.completed, total: ctx.completed + (connections.length - completedThisPass), elapsedMs: now() - ctx.startMs });

    if (completedThisPass === 0) {
      stagnant++;
      if (ctx.settings.maxStagnantPasses > 0 && stagnant >= ctx.settings.maxStagnantPasses) { stoppedBy = "stagnant"; break; }
    } else {
      stagnant = 0;
    }
  }

  return { passes, stoppedBy, timedOut: false, aborted: false };
}

/** Build a fresh RouteCtx over `layout` with a live Lattice and Journal. */
export function createCtx(layout: Layout, settings: RouteSettings, hooks?: RouteHooks): RouteCtx {
  const lattice = buildLattice(layout);
  const journal = createJournal(layout, lattice);
  const startMs = now();
  const deadline = settings.timeBudgetMs !== undefined ? startMs + settings.timeBudgetMs : undefined;
  return {
    layout, lattice, journal, settings, hooks,
    ripHistory: createRipupHistory(),
    ignored: ignoredNets(layout, settings.ignoreNetGroups.length ? settings.ignoreNetGroups : undefined),
    startMs,
    deadline,
    completed: 0,
    attempted: 0,
    ripped: 0,
    profiles: new Map(),
    preferDir: defaultPreferDirs(layout),
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
