/**
 * Optimiser — the post-routing quality pass (docs/DESIGN.md §6 `optimise.ts`; spec/behaviour/
 * scenarios/optimizer-monotonicity.md; contract R-6). It only ever makes the board *better*:
 *
 *   - Barrel elimination: a `free` router Barrel whose removal leaves every connection still
 *     complete is dropped (fewer Barrels).
 *   - Bend straightening / shortcut: a `free` router Track is replaced by a shorter clear polyline
 *     with the same endpoints (less Track length), kept only when it is strictly shorter, passes
 *     the exact clearance predicate (R-1) and leaves connectivity unchanged.
 *
 * Both directions are monotone, so R-6 holds by construction: the Barrel count and total Track
 * length never increase, no complete connection becomes incomplete, and — because nothing that
 * fails the exact predicate is inserted and `held`/`locked` items are never touched — R-1 and R-2
 * still hold. Bounded by `optimizerEnabled`, `optimizerPasses`, `optimizerMaxItems`. Deterministic:
 * items in id order.
 *
 * Public surface: OptimiseResult, runOptimise.
 */
import type { Layout, Pt, Track } from "../../spec/types/layout.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";
import type { Lattice } from "../lattice/index.ts";
import { connectivity, incompleteCount } from "../drc/index.ts";
import type { Journal } from "./journal.ts";
import { ignoreOf, sweepClear } from "./clear.ts";
import { resolveProfile, type Profile } from "./profile.ts";
import { pullPath } from "./pull.ts";
import { pathLength } from "../geom/index.ts";

export interface OptimiseResult { barrelsRemoved: number; tracksShortened: number }

function totalIncomplete(layout: Layout, lattice: Lattice, ignored: ReadonlySet<number>): number {
  const conn = connectivity(layout, lattice);
  let sum = 0;
  for (const net of layout.nets) { if (!ignored.has(net.id)) sum += incompleteCount(conn, net.id); }
  return sum;
}

/** Run the optimiser over `layout` (mutating through the Journal). */
export function runOptimise(layout: Layout, lattice: Lattice, journal: Journal, settings: RouteSettings, ignored: ReadonlySet<number>, deadline?: number): OptimiseResult {
  if (!settings.optimizerEnabled) return { barrelsRemoved: 0, tracksShortened: 0 };
  const passes = settings.optimizerPasses ?? 1;
  const maxItems = settings.optimizerMaxItems;
  const profiles = new Map<number | null, Profile>();
  const profileOf = (net: number | null): Profile => {
    let p = profiles.get(net);
    if (!p) { p = resolveProfile(layout, net, settings); profiles.set(net, p); }
    return p;
  };
  let base = totalIncomplete(layout, lattice, ignored);
  let barrelsRemoved = 0, tracksShortened = 0;
  let changes = 0;
  const overBudget = (): boolean => (maxItems !== undefined && changes >= maxItems) || (deadline !== undefined && Date.now() > deadline);

  for (let pass = 0; pass < passes; pass++) {
    let progressed = false;

    // Barrel elimination.
    for (const barrel of layout.barrels.slice().sort((a, b) => a.id - b.id)) {
      if (overBudget()) break;
      if (barrel.hold !== "free" || barrel.origin !== "router") continue;
      const mark = journal.mark();
      journal.remove(barrel.id);
      const now = totalIncomplete(layout, lattice, ignored);
      if (now <= base) { base = now; barrelsRemoved++; changes++; progressed = true; }
      else journal.rewind(mark);
    }

    // Bend straightening / shortcut.
    for (const track of layout.tracks.slice().sort((a, b) => a.id - b.id)) {
      if (overBudget()) break;
      if (track.hold !== "free" || track.origin !== "router" || track.pts.length < 3) continue;
      const profile = profileOf(track.net);
      const sheet = track.sheet;
      const ign = ignoreOf(track.net, [track.id]);
      const los = (a: Pt, b: Pt): boolean => sweepClear(layout, lattice, sheet, { a, b }, profile, ign, track.width).ok;
      const pulled = pullPath(track.pts, los);
      if (pulled.length >= track.pts.length && pathLength(pulled) >= pathLength(track.pts)) continue;
      if (pathLength(pulled) >= pathLength(track.pts)) continue;
      // Endpoints must be preserved so the K-01 joints stay.
      if (!samePt(pulled[0]!, track.pts[0]!) || !samePt(pulled[pulled.length - 1]!, track.pts[track.pts.length - 1]!)) continue;
      const mark = journal.mark();
      journal.remove(track.id);
      const replacement: Omit<Track, "id" | "origin"> = { net: track.net, sheet, pts: pulled, width: track.width, kind: track.kind, hold: "free" };
      journal.addTrack(replacement);
      const now = totalIncomplete(layout, lattice, ignored);
      if (now <= base) { base = now; tracksShortened++; changes++; progressed = true; }
      else journal.rewind(mark);
    }

    if (!progressed || overBudget()) break;
  }
  return { barrelsRemoved, tracksShortened };
}

function samePt(a: Pt, b: Pt): boolean { return a.x === b.x && a.y === b.y; }
