# Task I6b — SRJ connectivity model: reading (b) from the Q-68 ruling

Role: implementer. Write set: `src/srj/`, `test/` (srj tests).

Read `spec/formats/srj.md` (J-22, J-23, J-30, section 7's Q-68 ruling), `spec/rules/connectivity.md`
K-13…K-15, and the four `srj-*` cases.

The current adapter makes net-owned obstacles held Pours that each become a connectivity terminal
(reading (a)), inflating required connections to 52/188/187. The ruling is reading (b): the
required links for an SRJ design come **only** from `connections[].pointsToConnect` (an MST over
each connection's points, `max(0,k−1)` links); pre-existing net-owned copper is attachable same-net
helper copper, **not** an independent terminal.

1. Change `src/srj/build.ts` so net-owned obstacles are same-net attachable copper that does not
   add required connections — the connectivity/`requiredConnections` count for an SRJ Layout must
   be exactly Σ over connections of `max(0, points−1)` (15 on every J802 board). Keep them as
   obstacles to other nets (R-1).
2. `SrjDifferentialPair` now carries both shapes (`spec/types/srj.ts`, J-30); make `normalisePairs`
   read `connectionNames` (`_N` first, `_P` second) and `lengthTolerance` as the skew tolerance.
3. The four `srj-*` cases must report `incomplete` equal to the reference (2-layer 3; six-layer as
   the reference records) once vias exist. If I5's barrel-aware router is on `main` when you run,
   turn the advisory `incomplete` bounds hard where they now match; otherwise leave them advisory
   and note it.

Done when `bun run typecheck`, `check:layers`, `test` green; `requiredConnections` on each J802
Layout is 15; `bun run acceptance -- --tier all --case 'srj-*'` passes with `violations.maxAdded: 0`
hard. Update `src/QUESTIONS.md`. Commit with implementer trailers.
