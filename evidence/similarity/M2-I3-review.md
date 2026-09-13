# Similarity review — M2-I3 (I3 Lattice merge, orchestrator)

Gate: `bun run similarity -- --milestone M2-I3` (after adding the structural-variety filter).

| Finding | Our side | Disposition |
|---|---|---|
| PAIR `src/drc/index.ts` 0.222 (36 fingerprints) | zeroed stats object literal | boilerplate (reviewed M2-I0) |
| RUN `src/geom/predicates.ts` 40 tokens | ray-crossing point-in-polygon test | textbook (reviewed M2-I0) |
| RUN `test/acceptance-tools.test.ts` 43 tokens | expect chain + env save/restore in `finally` | test boilerplate (reviewed M2-I0) |
| CONST | iteration counts | informational |

Nothing new in I3's code (`src/lattice/`, `src/route/clear.ts`, `src/route/profile.ts`,
`test/lattice.test.ts`, `test/clear-vs-drc.test.ts`, `test/helpers/synth.ts`) is flagged after the
structural filter; the two earlier hits are unchanged. Verdict for I3: **no copying indicated**.
