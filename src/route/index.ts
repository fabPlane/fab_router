/**
 * `src/route` — the router (docs/DESIGN.md §6). Literature: Hart, Nilsson & Raphael (1968) A*;
 * Nash et al. (2007) Theta* string pulling; Dees & Karger (1982) rip-up and reroute; McMurchie &
 * Ebeling (1995) PathFinder negotiated congestion; Dion & Monier (1995) Contour tile router;
 * Finkel & Bentley (1974) quadtrees for the Quilt; Lee (1961) and Soukup (1978) for the maze
 * search lineage.
 *
 * The search, legaliser, Journal and passes are tasks I4/I5. This file fixes the shared
 * vocabulary (Trail, Journal mark) and the empty report the API stub returns.
 *
 * Public surface: Trail, TrailLeg, JournalMark, emptyReport.
 */
import type { Pt } from "../geom/index.ts";
import type { RouteReport } from "../../spec/types/results.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";

/** One leg of a Trail: an integer polyline on one Sheet. */
export interface TrailLeg { sheet: number; pts: Pt[] }
/** A search result before legalisation: legs joined by Barrel drops at shared endpoints. */
export interface Trail { legs: TrailLeg[]; barrels: Array<{ at: Pt; fromSheet: number; toSheet: number; form: number }> }
/** Opaque position in the Journal returned by `mark()` and accepted by `rewind(mark)`. */
export type JournalMark = number;

/** A RouteReport describing a run that did nothing. */
export function emptyReport(effectiveSettings: RouteSettings, stoppedBy: RouteReport["stoppedBy"] = "maxPasses"): RouteReport {
  return {
    passes: 0,
    attempted: 0, completed: 0, incompleteBefore: 0, incompleteAfter: 0,
    added: { tracks: 0, barrels: 0 },
    ripped: 0,
    violationsBefore: 0, violationsAdded: 0,
    timedOut: false, aborted: false, stoppedBy,
    effectiveSettings,
    wallClockMs: 0,
    perNet: [],
  };
}

// Task I3: the per-connection Profile and the exact clearance queries.
export * from "./profile.ts";
export * from "./clear.ts";

// Task I4: Journal, Quilt, search, pull, legalise, rip-up and the pass loop.
export * from "./journal.ts";
export * from "./quilt.ts";
export * from "./search.ts";
export * from "./pull.ts";
export * from "./legalise.ts";
export * from "./ripup.ts";
export * from "./passes.ts";

// Task I5: vias, fanout, nudge and the optimiser.
export * from "./via.ts";
export * from "./fanout.ts";
export * from "./nudge.ts";
export * from "./optimise.ts";

// Task I8: geometric push-and-shove.
export * from "./shove.ts";

// Task I9: gridless line-search detailed router (M9b-1).
export * from "./lineprobe.ts";
