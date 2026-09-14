/**
 * Shove — geometric push-and-shove of movable free Tracks (docs/DESIGN.md §9a). Literature: Dai,
 * Kong, Jue & Sato (1991) rubber-band routing / routability of a rubber-band sketch, and Cohoon &
 * Heck (1988) BEAVER switchbox routing — the shove primitive of topological routing reduced here to
 * a local geometric move on the integer-polyline Track model. Rip-up (Dees & Karger 1982) deletes a
 * blocking free Track and reroutes it from scratch; a shove instead *displaces* it perpendicular to
 * itself by the minimum distance that clears the wanted leg, keeping its endpoints fixed so the
 * shoved net stays exactly as complete as before, then re-checks the reshaped Track with the exact
 * `sweepClear` predicate and cascades to its own movable neighbours.
 *
 * `shoveClear` mirrors `nudgeClear` (src/route/nudge.ts) and enters the strategy ladder before
 * rip-up. Every move goes through the Journal; on any infeasibility — an immovable blocker, a
 * displacement past `windowLu`, or the depth/moved budget — the whole trial is rewound atomically,
 * so the board is never left worse. Contract holds by construction: nothing reaches the committed
 * state without passing the exact clearance predicate (R-1), and only `free` other-net Tracks
 * (`isRippable`) are ever moved — never Pads, Barrels, Pours, Fences, the Rim, or `held` / `locked`
 * / Prior copper (R-2, glossary "Shove").
 *
 * Public surface: ShoveBudget, shoveClear.
 */
import type { Layout, Track } from "../../spec/types/layout.ts";
import type { Pt, Seg } from "../geom/index.ts";
import { dist2SegSeg } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import type { Journal } from "./journal.ts";
import { isRippable } from "./ripup.ts";
import { ignoreOf, sweepClear, type IgnoreSet } from "./clear.ts";
import type { Profile } from "./profile.ts";

/** Bounds on one shove trial (spec/api/settings.md `shove*`). */
export interface ShoveBudget {
  /** Max perpendicular displacement of one shoved segment, in LU. */
  windowLu: number;
  /** Cascade recursion bound for transitive shoves. */
  maxDepth: number;
  /** Max segments moved in one trial. */
  maxMoved: number;
}

/** What a victim Track is being pushed away from: a set of segments, their Kind and half-width. */
interface Target {
  segs: readonly Seg[];
  kind: number;
  halfWidth: number;
  centre: Pt;
}

interface MoveCounter { moved: number }

/**
 * Make `seg` clear on `sheet` by shoving the `free` other-net Tracks that block it out of the way,
 * perpendicular to themselves, cascading to their movable neighbours. Returns true when `seg` is
 * clear afterwards (the Journal holds the moves; the caller may then insert its leg). On any
 * failure the whole trial is fully rewound and false is returned.
 */
export function shoveClear(
  layout: Layout, lattice: Lattice, journal: Journal, sheet: number, seg: Seg,
  profile: Profile, ignore: IgnoreSet, budget: ShoveBudget,
): boolean {
  if (sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width).ok) return true;
  if (budget.windowLu <= 0 || budget.maxMoved <= 0 || budget.maxDepth <= 0) return false;

  const ctx: ShoveCtx = { layout, lattice, journal, sheet, profile, budget };
  const target: Target = { segs: [seg], kind: profile.trackKind, halfWidth: profile.halfWidth, centre: midOf(seg.a, seg.b) };
  const counter: MoveCounter = { moved: 0 };
  const mark = journal.mark();
  if (resolveBlockers(ctx, [seg], profile, ignore, target, 0, counter)) return true;
  journal.rewind(mark);
  return false;
}

interface ShoveCtx {
  layout: Layout;
  lattice: Lattice;
  journal: Journal;
  sheet: number;
  profile: Profile;
  budget: ShoveBudget;
}

/**
 * Clear `probeSegs` (checked with `probeProfile` and `ignore`) of every movable Track blocking
 * them, pushing each away from `pushTarget`; re-verify the probes exactly afterwards.
 */
function resolveBlockers(
  ctx: ShoveCtx, probeSegs: readonly Seg[], probeProfile: Profile, ignore: IgnoreSet,
  pushTarget: Target, depth: number, counter: MoveCounter,
): boolean {
  // Gather the distinct blocking ids across every probe; each must be a rippable free Track.
  const victimIds: number[] = [];
  const seen = new Set<number>();
  for (const s of probeSegs) {
    const r = sweepClear(ctx.layout, ctx.lattice, ctx.sheet, s, probeProfile, ignore, probeProfile.width);
    if (r.ok) continue;
    for (const id of r.blocking) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!isRippable(ctx.layout, ctx.lattice, id, ignore.net)) return false;
      const entry = ctx.lattice.itemOf(id);
      if (!entry || entry.cat !== "track") return false;
      victimIds.push(id);
    }
  }
  if (victimIds.length === 0) return true; // already clear
  victimIds.sort((a, b) => a - b);

  for (const id of victimIds) {
    const entry = ctx.lattice.itemOf(id);
    if (!entry || entry.cat !== "track") return false; // may have moved under a cascade
    if (!shoveTrack(ctx, entry.item as Track, pushTarget, depth, counter)) return false;
  }
  // Exact re-verification: every probe must now be clear.
  for (const s of probeSegs) {
    if (!sweepClear(ctx.layout, ctx.lattice, ctx.sheet, s, probeProfile, ignore, probeProfile.width).ok) return false;
  }
  return true;
}

/**
 * Displace one Track `t` perpendicular to itself, away from `target`, by the minimum distance that
 * clears it; commit the reshaped Track through the Journal and cascade-shove any movable Track the
 * reshape now touches. Rolls its own move back on failure.
 */
function shoveTrack(ctx: ShoveCtx, t: Track, target: Target, depth: number, counter: MoveCounter): boolean {
  if (depth >= ctx.budget.maxDepth) return false;
  const pts = t.pts;
  if (pts.length < 2) return false;

  const th = t.width / 2;
  const need = ctx.layout.spacing.get(t.kind, target.kind, ctx.sheet) + th + target.halfWidth;
  const axis = axisOf(pts);
  const perp = { x: -axis.y, y: axis.x };
  const tc = midOf(pts[0]!, pts[pts.length - 1]!);
  // Push away from the target's centre: pick the perpendicular sign that increases distance.
  const away = dot(sub(tc, target.centre), perp) >= 0 ? 1 : -1;

  const cur = Math.sqrt(minDist2(pts, target.segs));
  // The minimum move when the Track runs *parallel* to the target (distance grows directly with the
  // displacement); a Track that *crosses* the target needs a larger move to slide past its end, so
  // the distances grow up to the window and the cheap `clearsTarget` gate below picks the first that
  // actually clears — only then is a move committed.
  const baseD = Math.max(1, Math.ceil(need - cur) + 2);
  const dists = candidateDistances(baseD, ctx.budget.windowLu);

  // Try the away sign first, then the opposite (in case the centre test misjudged a bent Track).
  for (const sign of [away, -away]) {
    const u = { x: perp.x * sign, y: perp.y * sign };
    for (const d of dists) {
      const newPts = displace(pts, u, d);
      if (!clearsTarget(newPts, target, t.kind, th, ctx.layout, ctx.sheet)) continue;

      const savedMoved = counter.moved;
      const mark = ctx.journal.mark();
      ctx.journal.remove(t.id);
      counter.moved++;
      if (counter.moved > ctx.budget.maxMoved) { ctx.journal.rewind(mark); counter.moved = savedMoved; return false; }
      const newT = ctx.journal.addTrack({ net: t.net, sheet: ctx.sheet, pts: newPts, width: t.width, kind: t.kind, hold: "free" });

      // Re-check the reshaped Track exactly, using a Profile that carries this Track's own Kind and
      // width so clearance and Lattice-query margins are correct (the wanted Profile is the template).
      const tProfile = trackProfile(ctx.profile, t);
      const tIgnore = ignoreOf(t.net, [newT.id]);
      const legs = legsOf(newPts);
      const childTarget: Target = { segs: legs, kind: t.kind, halfWidth: th, centre: midOf(newPts[0]!, newPts[newPts.length - 1]!) };
      if (resolveBlockers(ctx, legs, tProfile, tIgnore, childTarget, depth + 1, counter)) return true;

      ctx.journal.rewind(mark);
      counter.moved = savedMoved;
    }
  }
  return false;
}

// ---- geometry helpers -------------------------------------------------------------------------

function midOf(a: Pt, b: Pt): Pt { return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }; }
function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y }; }
function dot(a: Pt, b: Pt): number { return a.x * b.x + a.y * b.y; }

/** Unit vector along the Track's overall direction (first to last vertex); a safe default if degenerate. */
function axisOf(pts: readonly Pt[]): Pt {
  const a = pts[0]!, b = pts[pts.length - 1]!;
  let dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    // Degenerate span: fall back to the first non-zero leg.
    for (let i = 1; i < pts.length; i++) { dx = pts[i]!.x - a.x; dy = pts[i]!.y - a.y; if (dx !== 0 || dy !== 0) break; }
  }
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Displacement magnitudes to try, from the parallel-case minimum up to the window (≤ 12 values). */
function candidateDistances(baseD: number, windowLu: number): number[] {
  const out: number[] = [];
  let d = Math.min(baseD, windowLu);
  while (d <= windowLu && out.length < 11) {
    out.push(d);
    const next = Math.max(d + 1, Math.ceil(d * 1.6));
    if (next > windowLu) break;
    d = next;
  }
  if (out.length === 0 || out[out.length - 1] !== windowLu) out.push(windowLu);
  return out;
}

function legsOf(pts: readonly Pt[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1]!, b: pts[i]! });
  return out;
}

/**
 * Shift the Track perpendicular to itself by `d·u`, keeping its endpoints fixed. A straight
 * (two-vertex) Track has no interior vertex, so a "bump" is introduced at the quarter points; a
 * Track that already has interior vertices has them all shifted.
 */
function displace(pts: readonly Pt[], u: Pt, d: number): Pt[] {
  const dv = { x: Math.round(d * u.x), y: Math.round(d * u.y) };
  const a = pts[0]!, b = pts[pts.length - 1]!;
  if (pts.length === 2) {
    const q1 = { x: Math.round(a.x + 0.25 * (b.x - a.x)) + dv.x, y: Math.round(a.y + 0.25 * (b.y - a.y)) + dv.y };
    const q2 = { x: Math.round(a.x + 0.75 * (b.x - a.x)) + dv.x, y: Math.round(a.y + 0.75 * (b.y - a.y)) + dv.y };
    return [a, q1, q2, b];
  }
  const out: Pt[] = [a];
  for (let i = 1; i < pts.length - 1; i++) out.push({ x: pts[i]!.x + dv.x, y: pts[i]!.y + dv.y });
  out.push(b);
  return out;
}

/** Minimum squared distance between a polyline's legs and a set of target segments. */
function minDist2(pts: readonly Pt[], segs: readonly Seg[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    for (const s of segs) {
      const d = dist2SegSeg(pts[i - 1]!, pts[i]!, s.a, s.b);
      if (d < best) best = d;
    }
  }
  if (best === Infinity) {
    // A single point (no legs) vs the segments.
    for (const s of segs) { const d = dist2SegSeg(pts[0]!, pts[0]!, s.a, s.b); if (d < best) best = d; }
  }
  return best;
}

/**
 * Would the reshaped Track (`newPts`, Kind `tk`, half-width `th`) keep `target`'s required
 * clearance? A cheap gate that avoids committing a hopeless move; the authoritative check is the
 * exact `sweepClear` re-verification in `resolveBlockers`.
 */
function clearsTarget(newPts: readonly Pt[], target: Target, tk: number, th: number, layout: Layout, sheet: number): boolean {
  const need = layout.spacing.get(tk, target.kind, sheet) + th + target.halfWidth;
  const need2 = need * need;
  return minDist2(newPts, target.segs) >= need2;
}

/** A Profile that re-checks a moved Track with its own Kind and width (spacing / margins exact). */
function trackProfile(template: Profile, t: Track): Profile {
  return { ...template, width: t.width, halfWidth: t.width / 2, trackKind: t.kind };
}
