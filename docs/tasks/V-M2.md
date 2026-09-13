# Task V-M2 — verify milestone M2 (read + foundation)

Role: verifier. This checkout is `main` after the I0, I1 and I3 merges.

1. Run and capture: `bun run typecheck`, `bun run check:layers`, `bun run test`,
   `bun run acceptance -- --tier all --case 'parse-*' --report evidence/reports/M2-parse.json`,
   `bun run acceptance -- --tier all --case 'rules-*' --report evidence/reports/M2-rules.json`.
2. Write **and commit** (with the verifier trailers `Wall-Role: verifier`, `Agent-Id: <id>`,
   `Spec-Tree: <git rev-parse HEAD:spec>`) `evidence/reports/M2.md`: commit hash verified; each
   command pass/fail with numbers; for the
   parse cases the count passed/failed and every failing case id with its one-line reason; the
   vector suite totals; open entries in `src/QUESTIONS.md`.
3. Verdict GREEN if typecheck, layers, unit tests, every geometry and lexeme vector, and every
   `parse-*` case pass (advisory mismatches allowed); otherwise RED with the list.
