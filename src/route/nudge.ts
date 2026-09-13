/**
 * Nudge — rip-local-reroute of conflicting `free` legs in a bounded window, rolled back through the
 * Journal on failure (docs/DESIGN.md §6 `nudge.ts`). When a wanted leg is blocked only by `free`
 * other-net Tracks, nudge rips exactly those Tracks, asks the caller to reroute each of them (their
 * own endpoints preserved, so their connections stay complete), and keeps the result only when the
 * wanted leg is then clear *and* every ripped Track found a new home. Anything less rolls the whole
 * trial back, so the board never ends up worse (contract R-1/R-2 hold: nothing that fails the exact
 * predicate is inserted, `held`/`locked` items are never touched).
 *
 * This is preferred over geometric push-and-shove because it reuses the search and is DRC-clean by
 * construction (docs/DESIGN.md §6). The reroute itself is supplied by the caller (the pass loop
 * owns the router), which keeps this module free of a dependency cycle.
 *
 * Public surface: RerouteFn, nudgeClear.
 */
import type { Layout, Pt, Track } from "../../spec/types/layout.ts";
import type { Seg } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import type { Journal } from "./journal.ts";
import { isRippable } from "./ripup.ts";
import { sweepClear, type IgnoreSet } from "./clear.ts";
import type { Profile } from "./profile.ts";

/** Reroute a Track of `net` between two points on `sheet`; true when it was re-placed clear. */
export type RerouteFn = (net: number | null, sheet: number, from: Pt, to: Pt) => boolean;

/**
 * Make `seg` clear on `sheet` by nudging the `free` other-net Tracks that block it out of the way.
 * Returns true when `seg` is clear afterwards (the Journal holds the moves; the caller may then
 * insert its leg). On any failure the trial is fully rewound and false is returned.
 */
export function nudgeClear(
  layout: Layout, lattice: Lattice, journal: Journal, sheet: number, seg: Seg,
  profile: Profile, ignore: IgnoreSet, reroute: RerouteFn, maxLegs = 6,
): boolean {
  const first = sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width);
  if (first.ok) return true;
  // Every blocker must be a rippable free other-net Track (Barrels/Pads/Rim cannot be nudged).
  const victims: Track[] = [];
  const seen = new Set<number>();
  for (const id of first.blocking) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!isRippable(layout, lattice, id, ignore.net)) return false;
    const entry = lattice.itemOf(id);
    if (!entry || entry.cat !== "track") return false;
    victims.push(entry.item as Track);
  }
  if (victims.length === 0 || victims.length > maxLegs) return false;

  const mark = journal.mark();
  const specs = victims.map((t) => ({ net: t.net, sheet: t.sheet, from: t.pts[0]!, to: t.pts[t.pts.length - 1]! }));
  for (const v of victims) journal.remove(v.id);
  for (const s of specs) {
    if (!reroute(s.net, s.sheet, s.from, s.to)) { journal.rewind(mark); return false; }
  }
  if (!sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width).ok) { journal.rewind(mark); return false; }
  return true;
}
