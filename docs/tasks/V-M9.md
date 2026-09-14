# Task V-M9 — verify milestone M9 (detailed router: shove + gridless)

Role: verifier. This checkout is `main`.

1. Run and capture exit code + numbers: `bun run typecheck`, `bun run check:layers`,
   `bun run test`, and `bun run acceptance -- --tier all --case 'routing-*' --report
   evidence/reports/M9-routing.json` and `--case 'srj-*' --report evidence/reports/M9-srj.json`.
2. The HARD bar (must all hold, else RED): `violations.maxAdded == 0` on every routing + srj case;
   `preExisting == 0` on the srj cases; R-2/R-5/R-6 where pinned; no regression on any case that
   passed at tag M8.
3. Record, per board that had an unmet/advisory completion bound at M8 (the dense DSN boards and
   the four J802 SRJ boards), the completion reached now vs the S9 reference bound
   (`spec/acceptance/reference/*.bound*.json`), and whether each advisory bound became hard.
4. Write **and commit** (verifier trailers `Wall-Role: verifier`, `Agent-Id: <id>`,
   `Spec-Tree: <git rev-parse HEAD:spec>`) `evidence/reports/M9.md`: commit hash; each command
   pass/fail; the completion table (M8 → M9 → reference bound); open `src/QUESTIONS.md` entries.
5. Verdict GREEN if the hard bar holds and completion improved measurably toward the reference
   bounds on the target boards (note, do not fail on, any board the implementers documented as
   out of reach for this milestone). Else RED with the list.
