/**
 * `src/ses` — SPECCTRA session-file writer and reader (docs/DESIGN.md §3; spec/formats/ses.md;
 * SPECCTRA Design Language Reference, Cadence 2003). `write.ts` emits `(session …)` with integer
 * coordinates in resolution units, `library_out` PadForms used by written Barrels and
 * `network_out` wires and vias; `apply.ts` reads `routes/network_out` back onto a Layout.
 * Both are task I2. This file fixes the option and result vocabulary.
 *
 * Public surface: re-exported SesWriteOptions and ApplyResult.
 */
export type { ApplyResult, SesWriteOptions } from "../../spec/types/results.ts";
