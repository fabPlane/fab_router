/**
 * `src/srj` — the tscircuit SimpleRouteJson adapter (spec/types/srj.ts; mapping in
 * spec/api/contract.md "SimpleRouteJson" and docs/DESIGN.md §7's `src/srj` row). Converts an SRJ
 * document (mm units) into a Layout (`build.ts`), and, after the core `route()` has run, reads the
 * router-added copper back out as `pcb_trace` elements and measures differential-pair length and
 * skew (`traces.ts`). The `routeSrj` entry point (spec/api/contract.md) wires these around a
 * `route()` call in `src/api.ts`. Task I6.
 *
 * Public surface: the SRJ builder and trace/measurement helpers, plus the re-exported SRJ types.
 */
export { buildSrjLayout, sheetNames, srjClearanceUm, type SrjLayout } from "./build.ts";
export {
  extractTraces, measurePairs, normalisePairs, type PairMeasure, type PairSpec,
} from "./traces.ts";
export type {
  SimpleRouteJson, SrjConnection, SrjObstacle, SrjRouteResult, SrjRouteStep, SrjTrace,
} from "../../spec/types/srj.ts";
