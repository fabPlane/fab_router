# Task S6 — correct reference data flagged by I2

Role: spec-curator. Write set: `spec/acceptance/reference/`, `spec/acceptance/ses/`,
`spec/acceptance/cases/` (only the cases named below).

Read `spec/api/contract.md` rulings Q-I2-49, Q-I2-50, Q-I2-51, Q-I2-58, and `spec/formats/ses.md`
F-43/F-54, F-S61.

1. **`traceLengthMm` ×10 (Q-I2-58).** Every `reference/*.json` on a `resolution um 10` board has
   `traceLengthMm` one tenth of the true millimetre value (resolution units ÷ 10⁵ instead of ÷ 10⁴).
   Recompute `refA.traceLengthMm` and `refB.traceLengthMm` correctly (regenerate from the harness,
   or multiply by the board's `perUnit`/10 factor) for every reference file; note the correction in
   each file's `notes`. Check the ten routing cases that use `traceLengthMm` `maxRatioToReference`
   still bracket sensibly.
2. **Three `ses-roundtrip` trees (Q-I2-51).** Regenerate
   `ses/{Issue187-processor.Z80,Issue103-board,Issue191-processor.Z80-processor}.dsn.unrouted.sexp.json`
   so each `polyline_path` corner is the exact intersection rounded by F-43 (halves toward +∞), not
   float-rounded. Use an exact (integer/rational) computation, not float64 in file units.
3. **Re-measure the three amended ses-apply cases (Q-I2-49/50).** For
   `ses-apply-issue191-processor-z80-processor`, `ses-apply-issue313-fasttest`,
   `ses-apply-issue690-ecc83`: apply the session under F-S61 (held file wiring removed) and record
   the true `incomplete` and `violations` in each case's `expect` (they are currently `advisory`);
   remove the `advisory` flag. Use reference B applied with F-S61 semantics, or the merged
   implementation on `main` if you prefer (it is clean code, not a reference).

Run `bun run spec:lint`; commit with spec-curator trailers; report the corrected files.
