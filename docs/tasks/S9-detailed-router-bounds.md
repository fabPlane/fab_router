# Task S9 — reference completion bounds and shove/detailed-routing scenarios for M9

Role: spec-curator. Write set: `spec/behaviour/scenarios/`, `spec/acceptance/reference/`,
`spec/acceptance/cases/` (routing + srj completion bounds only), `spec/rules/connectivity.md`
(a "detailed routing / shove outcomes" section only).

The M9 milestone adds a detailed router with push-and-shove to close the completion gaps documented
in `evidence/reports/M8-audit.md` §4 and `src/QUESTIONS.md` (I7 notes). This task establishes, by
observation of the reference implementations (locations in the private runbook named in your spawn
prompt; run them as sealed programs), what completion is actually achievable, so the implementer has
hard targets rather than "route better".

## Deliverables

1. **Reference completion bounds** — for every board with an unmet or advisory completion bound
   (the dense DSN boards: DAC bm01/bm07/bm11, cm5-carrier, green14seg, the fanout-route exact-0
   cases; and the four J802 SRJ boards), run BOTH references under a generous budget (record the
   budget) and record in `spec/acceptance/reference/<board>.<profile>.json`: connections,
   incompleteAfter, vias, traceLengthMm, passes, wallClockMs, and whether each reference actually
   reaches the case's target (e.g. does any reference truly hit bm07 exact-0, and in what time?).
   Where neither reference reaches a bound the current case pins, say so — the case bound may be
   aspirational and should be relaxed to the best observed value.
2. **Shove / detailed-routing outcome scenarios** — `spec/behaviour/scenarios/detailed-routing.md`
   and `shove.md`: OUTCOME-ONLY statements (never procedure). For a congested region on a named
   board: "with shove enabled, connection C completes where it did not without it; no held/locked/
   Prior item moved; zero added violations." For a locked-channel board (J802): "connection C
   routes through the channel between Prior copper X and Y at clearance ≥ the rule." Use the
   record/replay method: describe observable results on recorded scenarios, not the algorithm.
3. **Connectivity/shove clause** — add a short "detailed routing outcomes" subsection to
   `spec/rules/connectivity.md` (or drc.md) stating the invariants a shove must preserve
   (R-1/R-2 restated as observable: a shoved item stays DRC-clean and same net; locked/held/Prior
   never move), so the acceptance runner and the implementer share one definition.
4. **Update the acceptance cases** — set each affected routing/srj `incomplete`/`completed` bound
   to the best reference-observed value, marking hard the ones a reference actually reaches and
   advisory the ones it does not (with the observed number in `note`). Keep `violations.maxAdded: 0`
   and `preExisting` hard everywhere.

Run `bun run spec:lint`; commit with spec-curator trailers; report per board: the reference's best
completion, the budget, and which case bounds you made hard vs advisory.
