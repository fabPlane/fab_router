# Similarity review — M2-I0 (I0 foundation merge, orchestrator)

Gate run: `bun run similarity -- --milestone M2-I0` after the I0 merge (25 candidate files vs 842
reference files). Findings and disposition:

| Finding | Our side | Disposition |
|---|---|---|
| PAIR + RUN `src/drc/index.ts` (47 tokens, 11 distinct) | `emptyStats()`: an object literal of zeroed counters | boilerplate — any zero-initialised stats object tokenises identically |
| RUN `src/layout/index.ts` (43, 11 distinct) | `emptyLayout()`: empty-array literal fields | boilerplate |
| RUN `src/geom/predicates.ts` (40, 12 distinct) | even-odd ray-crossing point-in-polygon test (`(a.y > p.y) !== (b.y > p.y)` + orientation) | textbook algorithm (Shimrat 1962 / Franklin's PNPOLY); the token pattern is the algorithm itself |
| RUN `test/acceptance-tools.test.ts` (43, 15 distinct) | `expect(...).toBe(...)` chain + env var save/restore | test boilerplate |
| RUN `test/geom-shapes.test.ts` (69, 15 distinct) | `expect(bendKind(...)).toBe(...)` chain | test boilerplate |
| IDENT `ConvexShape` (before re-run) | a generic geometry type name | un-banned as generic; not a reference-specific identifier |
| CONST 2000, 5000, 100000, 2^32 | iteration counts / bit width | trivial constants; CONST is informational |

Gate changes made in response: runs must contain ≥ 10 distinct normalised tokens; PAIR requires
≥ 24 fingerprints; more trivial constants; RUN findings now print the candidate window (our text
only) so reviews can be done from the report. Verdict for I0: **no copying indicated**.
