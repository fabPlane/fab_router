/**
 * Via selection and Barrel dropping (docs/DESIGN.md §6; spec/rules/vias.md V-06, V-10). A Barrel
 * candidate joins two Sheets only when its PadForm's span covers both (blind / buried candidates
 * used only when their span matches exactly or no through candidate fits, V-06). `dropViaNear`
 * finds the first clear point on a ring around a target where a spanning Barrel fits — the shared
 * primitive of fanout (SMD escape) and plane-net completion (a Barrel spanning a plane Sheet joins
 * the plane's Pour, K-04/K-07). Deterministic: candidates in via-rule order, offsets in a fixed
 * ring order.
 *
 * Public surface: pickBarrel, spanCovers, dropViaNear, ViaDrop.
 */
import type { Layout, Pt } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";
import { barrelFits, sweepClear, type IgnoreSet } from "./clear.ts";
import type { BarrelCandidate, Profile } from "./profile.ts";

/** Does the candidate's span cover both Sheet ids? */
export function spanCovers(cand: BarrelCandidate, a: number, b: number): boolean {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return cand.fromSheet <= lo && cand.toSheet >= hi;
}

/**
 * The first Barrel candidate that spans Sheets `a`..`b`, preferring the tightest span (a candidate
 * whose span equals the needed range comes before a wider one), otherwise via-rule order (V-06).
 */
export function pickBarrel(profile: Profile, a: number, b: number): BarrelCandidate | undefined {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  let exact: BarrelCandidate | undefined;
  let wider: BarrelCandidate | undefined;
  for (const c of profile.barrelForms) {
    if (!spanCovers(c, lo, hi)) continue;
    if (c.fromSheet === lo && c.toSheet === hi) { if (!exact) exact = c; }
    else if (!wider) wider = c;
  }
  return exact ?? wider;
}

export interface ViaDrop { at: Pt; candidate: BarrelCandidate; stub: Pt[]; sheet: number }

/**
 * Find a clear place to drop a Barrel joining `sheet` to `otherSheet`, near `target`, reachable
 * from `target` on `sheet` by a clear stub. Tries the target itself, then a ring of offsets at
 * growing radius (axis and diagonal directions). Returns the placement and the stub polyline, or
 * `undefined` when nothing fits within the ring.
 */
export function dropViaNear(
  layout: Layout, lattice: Lattice, sheet: number, otherSheet: number, target: Pt,
  profile: Profile, ignore: IgnoreSet, maxRadius: number,
): ViaDrop | undefined {
  const cand = pickBarrel(profile, sheet, otherSheet);
  if (!cand) return undefined;
  const los = (a: Pt, b: Pt): boolean => sweepClear(layout, lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  const tryAt = (at: Pt): ViaDrop | undefined => {
    if (!barrelFits(layout, lattice, at, cand, profile, ignore).ok) return undefined;
    if (at.x === target.x && at.y === target.y) return { at, candidate: cand, stub: [target], sheet };
    if (los(target, at)) return { at, candidate: cand, stub: [target, at], sheet };
    // Straight stub blocked: try the two L-corners.
    const c1 = { x: at.x, y: target.y }, c2 = { x: target.x, y: at.y };
    if (los(target, c1) && los(c1, at)) return { at, candidate: cand, stub: [target, c1, at], sheet };
    if (los(target, c2) && los(c2, at)) return { at, candidate: cand, stub: [target, c2, at], sheet };
    return undefined;
  };
  const first = tryAt(target);
  if (first) return first;
  // Ring search: grow the radius in fine steps, sixteen directions, in a fixed order.
  const dirs: Array<[number, number]> = [];
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; dirs.push([Math.cos(a), Math.sin(a)]); }
  const base = Math.max(1, Math.round((profile.width + profile.maxSpacing) / 2));
  for (let step = 1; step * base <= maxRadius; step++) {
    const r = step * base;
    for (const [dx, dy] of dirs) {
      const at = { x: Math.round(target.x + dx * r), y: Math.round(target.y + dy * r) };
      const hit = tryAt(at);
      if (hit) return hit;
    }
  }
  return undefined;
}
