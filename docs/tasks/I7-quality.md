# Task I7 — M7 quality: close the dense-board and J802 completion gaps

Role: implementer. Write set: `src/route/`, `src/srj/`, `test/`. Tuning and algorithm strength
only; do not change the public API or the spec.

The router is DRC-clean everywhere (R-1 holds) but misses completion bounds on the densest boards
and on J802. Read `src/QUESTIONS.md` (the I5 and I6c "M7 router-quality" notes),
`spec/behaviour/scenarios/*.md`, `spec/rules/connectivity.md` K-16, and the failing routing/srj
cases (those with an advisory or unmet `incomplete`/`completed` bound).

Known, specific gaps to close (each keeps R-1 hard):
1. **Prior copper does not join across Sheets** — a multi-layer net-owned obstacle becomes one
   Prior Pour per Sheet with no Barrel between them; the search does not treat same-net Prior
   copper as an explicit target. Make a route able to *reach* same-net Prior copper (K-16
   attachment) and, where the net's Prior copper spans Sheets through an existing Barrel, use it.
   This is what moves J802 from 14/15/15/15 toward the reference's 3/6/6/15.
2. **Global rip-up / reroute strength** — the dense boards (`cm5-carrier`, `dac2020-bm01`,
   `dac2020-bm07`, `issue034-green14seg`, the fanout-route exact-0 cases, `bm11-fanout-only`) miss
   their completion/via-count bounds. Strengthen the negotiated-congestion loop (ordering, history
   decay, ripup budget) and the escape/fanout search so more connections complete. Where a bound
   is genuinely out of reach for this milestone, say so per board with the number reached.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `bun run acceptance -- --tier all
--case 'routing-*'` and `--case 'srj-*'` improve measurably toward the reference — turn each
advisory `incomplete`/`completed` bound hard as you reach it; for any you cannot, record the board,
the number reached, and why in `src/QUESTIONS.md`. R-1 (`violations.maxAdded: 0`) and R-6 stay hard
on every case. Commit with implementer trailers.
