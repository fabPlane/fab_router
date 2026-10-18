# Budget rollback continuation validation

The two additional regressions exercise the continuation paths after a rejected
escape, rather than only checking final item counts. They use original synthetic
geometry and do not change production code.

* A mixed-rule board orders a non-attach pad before an attach-enabled pad on
  another net. With budget 1, the first escape must rewind and the second must
  insert its directly attached via. This also protects the `continue` behavior:
  replacing it with `break` would skip the affordable escape.
* A live lattice/journal test checks that rejected copper leaves no indexed
  items, slots, hits, directory records, or journal operations. A subsequent call
  with budget 4 escapes both pads. Rewinding that call restores the initial hits
  and journal statistics.

Both tests fail against main 69cf598 and pass against the candidate, consistently
in three repetitions on the same host and cores. Full geometry and statistics
are retained in rollback-before.json and rollback-after.json.

| Three repeated runs | Main | Candidate |
| --- | --- | --- |
| Mixed board, budget 1 | 2 items, first net only | 1 via, later net only |
| Rejected-stage added items | 2 | 0 |
| Subsequent budget-4 call | 1 new escape / 2 items | 2 new escapes / 4 items |
| Engine DRC violations in both final boards | 0 | 0 |
| Regression tests per repetition | 0 pass / 2 fail | 2 pass / 0 fail |

The subsequent call's budget applies to that call's additions; main's final total
is also four items because it wrongly retained two from the first call. The
candidate proves recovery from a genuine rollback. No native completion or
thermal improvement is implied.

```bash
bun test test/fanout-budget-rollback.test.ts
bun docs/pr-assets/agent-fab-router-fix-fanout-budget/rollback-audit.ts .
# Main source extracted to a scratch directory:
bun docs/pr-assets/agent-fab-router-fix-fanout-budget/rollback-audit.ts /path/to/main-source
bun run typecheck && bun run check:layers && bun run test
```

No new native sweep was run: every executable source file is identical to
cfe7376, already measured in benchmark-summary.json (26 cases × 3 repeats).
Those historical results remain 39/78 passing, 13/26 valid 3/3, 120 opens and
27 new thermal errors. This follow-up extends test coverage, not routing behavior.
