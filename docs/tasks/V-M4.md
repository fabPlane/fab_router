# Task V-M4 — verify milestones M3 (I/O + DRC + index) and M4 (routing v1)

Role: verifier. This checkout is `main`.

1. Run and capture (exit code + numbers): `bun run typecheck`, `bun run check:layers`,
   `bun run test`, then per-kind acceptance with reports under `evidence/reports/`:
   `bun run acceptance -- --tier all --case 'parse-*'    --report evidence/reports/M4-parse.json`
   and the same for `ses-roundtrip-*`, `ses-apply-*`, `rules-*`, `settings-*`, `drc-*`,
   `routing-*` (this last with `--tier all`).
2. Confirm the M3 bar: every parse, ses-roundtrip, ses-apply, rules, settings and drc case passes.
3. Confirm the M4 bar: every `routing-*` case adds **zero** DRC violations (R-1) and zero Barrels
   (this milestone has no vias); the fast routing cases pass except the four listed in
   `test/acceptance.test.ts`'s `DEFERRED_TO_I5` set, and those four still satisfy R-1 and R-4.
   List every routing case with its completion vs the reference and its `violationsAdded`.
4. Write **and commit** (verifier trailers `Wall-Role: verifier`, `Agent-Id: <id>`,
   `Spec-Tree: <git rev-parse HEAD:spec>`) `evidence/reports/M4.md`: commit hash; each command
   pass/fail with numbers; the routing table; open `src/QUESTIONS.md` entries.
5. Verdict GREEN if the M3 bar holds and every routing case has `violationsAdded == 0` and
   `addedBarrels == 0` (completion shortfalls limited to the DEFERRED_TO_I5 four); else RED.
