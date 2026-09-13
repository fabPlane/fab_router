# Task V-M5 — verify milestone M5 (routing v2: vias, multilayer, rip-up, fanout, optimiser)

Role: verifier. This checkout is `main`.

1. Run and capture exit code + numbers: `bun run typecheck`, `bun run check:layers`,
   `bun run test`, and `bun run acceptance -- --tier all --case 'routing-*' --report
   evidence/reports/M5-routing.json`. Also run `--case 'srj-*'` and `--case 'drc-*'`.
2. For every routing and srj case, record completion and `violationsAdded`. The **hard** bar is
   R-1 (`violationsAdded == 0`) on every case, and R-6 (optimiser never increases via count or
   length) where an optimiser case pins it. Completion shortfalls are allowed only where the case
   marks the bound advisory or the suite lists it deferred; list each shortfall with its board and
   numbers.
3. Confirm the feature cases pass to their hard bounds: DAC bm07/bm08 exact-0 incomplete, the
   multilayer boards (Issue066 4-layer, Issue289 6-layer), the plane-layer boards (Issue269),
   strict-DRC (CNH), and the item-cap cases (`completed <= maxItems`).
4. Write **and commit** (verifier trailers) `evidence/reports/M5.md`: commit hash; each command
   pass/fail; the routing/srj table; open `src/QUESTIONS.md` entries.
5. Verdict GREEN if typecheck/layers/test pass, every routing+srj case has `violationsAdded == 0`,
   and the hard-bound feature cases pass; else RED with the list. Note (do not fail on) the known
   dense-board completion gaps deferred to M7.
