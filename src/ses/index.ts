/**
 * `src/ses` — SPECCTRA session-file writer and reader (docs/DESIGN.md §3; spec/formats/ses.md;
 * SPECCTRA Design Language Reference, Cadence 2003). `write.ts` emits `(session …)` with integer
 * coordinates in resolution units, `library_out` PadForms and `network_out` wires and vias;
 * `normalise.ts` is the canonical tree of F-S50; `apply.ts` reads `routes/network_out` back onto
 * a Layout with the replacement semantics of F-S61.
 *
 * Public surface: writeSes, applySes, normaliseSes, canonicalText, attachDocument, documentOf,
 * resolutionOf, sesName, formatRotation, ROUTER_ADDED, and the re-exported option and result types.
 */
export type { ApplyResult, SesWriteOptions } from "../../spec/types/results.ts";
export { writeSes, attachDocument, documentOf, resolutionOf, sesName, formatRotation, ROUTER_ADDED } from "./write.ts";
export { applySes } from "./apply.ts";
export { normaliseSes, canonicalText, type SesTree } from "./normalise.ts";
