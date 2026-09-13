/**
 * Pull — Theta*-style string-pulling of a grid path into as few legs as possible using exact
 * line-of-sight checks (docs/DESIGN.md §6 `pull.ts`; Nash, Daniel, Koenig & Felner 2007, Theta*).
 * The grid A* (src/route/search.ts) returns a staircase of unit Seam crossings; this greedily
 * keeps the farthest vertex still reachable by a clear straight leg from the current anchor, which
 * removes the grid's quantisation without moving off DRC-clean copper (every kept leg passed the
 * same `sweepClear` the legaliser re-checks). It only proposes; legalise.ts re-checks.
 *
 * Public surface: LosClear, pullPath.
 */
import type { Pt } from "../geom/index.ts";
import { simplifyCollinear } from "../geom/index.ts";

/** Exact line-of-sight predicate: is the straight leg `a → b` clear? */
export type LosClear = (a: Pt, b: Pt) => boolean;

/**
 * Greedy Theta* shortcut: from each anchor, advance to the farthest later vertex reachable by a
 * clear straight leg. Guarantees the result is a subsequence of `pts` (endpoints kept), so it is
 * never longer than the input and every leg is a clear straight line.
 */
export function pullPath(pts: readonly Pt[], clear: LosClear): Pt[] {
  const src = simplifyCollinear(pts);
  if (src.length <= 2) return src.slice();
  const out: Pt[] = [src[0]!];
  let anchor = 0;
  while (anchor < src.length - 1) {
    // Find the farthest vertex visible in a straight line from the anchor.
    let next = anchor + 1;
    for (let j = src.length - 1; j > anchor + 1; j--) {
      if (clear(src[anchor]!, src[j]!)) { next = j; break; }
    }
    out.push(src[next]!);
    anchor = next;
  }
  return simplifyCollinear(out);
}
