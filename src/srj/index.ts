/**
 * `src/srj` — the tscircuit SimpleRouteJson adapter (spec/types/srj.ts; mapping to a Layout in
 * spec/formats/srj.md). Converts an SRJ document (mm units) into a Layout, runs the pipeline and
 * fills `traces`; also measures differential-pair length and skew. Task I6. This file fixes the
 * vocabulary.
 *
 * Public surface: re-exported SRJ types.
 */
export type { SimpleRouteJson, SrjConnection, SrjObstacle, SrjRouteResult, SrjRouteStep, SrjTrace } from "../../spec/types/srj.ts";
